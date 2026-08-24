import { describe, test, expect, vi, afterEach } from 'vitest'

function defaultConfigGet(key) {
  const values = {
    'auth.callbackBaseUrl': 'https://frontend.example',
    'auth.azureEntraId.tenantId': 'the-tenant-id',
    'auth.regulatorAccessDisabled': false
  }
  return values[key]
}

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => defaultConfigGet(key))
  }
}))
vi.mock('../common/helpers/auth/providers/defra-id.js', () => ({
  getDefraIdConfig: vi.fn(),
  getDefraIdEndpoints: vi.fn()
}))

const { getDefraIdConfig, getDefraIdEndpoints } =
  await import('../common/helpers/auth/providers/defra-id.js')

const { config } = await import('../../config/config.js')
const { logoutController } = await import('./controller.js')

// AC04-adjacent: signing out of our service should also end the session at
// whichever upstream IdP actually issued it, not just the local one —
// otherwise the user stays silently signed in to Entra ID / Defra ID and a
// subsequent login bounces straight back in via SSO. Operator (Defra ID)
// federated logout was implemented first; this locks in that the regulator
// (Entra ID) path does the same via Entra's own end_session endpoint.
function fakeYar(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: (key) => store.get(key),
    reset: () => store.clear()
  }
}

function mockH() {
  return { redirect: vi.fn().mockReturnValue('redirected') }
}

afterEach(() => {
  vi.restoreAllMocks()
  // restoreAllMocks only restores vi.spyOn-created mocks — config.get is a
  // plain vi.fn() from the module factory above, so a test that overrides
  // it with .mockImplementation() (below) would otherwise leak that
  // override into every later test in this file.
  config.get.mockImplementation((key) => defaultConfigGet(key))
})

describe('#logoutController federated logout', () => {
  test('regulator federated logout URL points at the tenant logout endpoint, carries the id_token, and tags the return leg with userType', async () => {
    const yar = fakeYar({
      user: { userType: 'regulator', id: 'reg-1' },
      idToken: 'the-entra-id-token'
    })
    const h = mockH()
    const request = { yar, query: {} }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledTimes(1)
    const [redirectUrl] = h.redirect.mock.calls[0]
    const url = new URL(redirectUrl)

    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/the-tenant-id/oauth2/v2.0/logout'
    )
    expect(url.searchParams.get('id_token_hint')).toBe('the-entra-id-token')

    // post_logout_redirect_uri is itself a URL-with-query-string, correctly
    // percent-encoded as a single param value.
    const postLogoutRedirectUri = new URL(
      url.searchParams.get('post_logout_redirect_uri')
    )
    expect(postLogoutRedirectUri.origin + postLogoutRedirectUri.pathname).toBe(
      'https://frontend.example/auth/logout'
    )
    expect(postLogoutRedirectUri.searchParams.get('userType')).toBe('regulator')
  })

  test('operator federated logout still goes through the Defra ID end_session endpoint', async () => {
    getDefraIdConfig.mockReturnValue({
      discoveryUrl: 'https://defra.example/.well-known/openid-configuration'
    })
    getDefraIdEndpoints.mockResolvedValue({
      endSessionUrl: 'https://defra.example/end-session'
    })

    const yar = fakeYar({
      user: { userType: 'operator', id: 'op-1' },
      idToken: 'the-defra-id-token'
    })
    const h = mockH()
    const request = { yar, query: {} }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledTimes(1)
    const [redirectUrl] = h.redirect.mock.calls[0]
    const url = new URL(redirectUrl)

    expect(url.origin + url.pathname).toBe('https://defra.example/end-session')
    expect(url.searchParams.get('id_token_hint')).toBe('the-defra-id-token')
  })

  test('resets the local session before redirecting to the IdP', async () => {
    const yar = fakeYar({
      user: { userType: 'regulator', id: 'reg-1' },
      idToken: 'the-entra-id-token'
    })
    const resetSpy = vi.spyOn(yar, 'reset')
    const request = { yar, query: {} }

    await logoutController(request, mockH())

    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  test('falls back to a plain local-session logout when there is no id_token', async () => {
    const yar = fakeYar({ user: { userType: 'regulator', id: 'reg-1' } })
    const h = mockH()
    const request = { yar, query: {} }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  // RA-427: a regulator session that predates REGULATOR_ACCESS_DISABLED
  // being switched on can still reach logout — /auth/regulator/login 404s
  // once disabled, so this must not dead-end the caller there.
  test('falls back to the operator login page when regulator access is disabled', async () => {
    config.get.mockImplementation((key) =>
      key === 'auth.regulatorAccessDisabled' ? true : undefined
    )

    const yar = fakeYar({ user: { userType: 'regulator', id: 'reg-1' } })
    const h = mockH()
    const request = { yar, query: {} }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  // RA-437 fix: on the round trip back from a federated logout, `user` has
  // already been reset by the first pass — the request that hits this
  // route as Entra/Defra ID's callback has no session at all, only the
  // userType query param this same controller put on
  // post_logout_redirect_uri. Without reading it, the fallback below
  // always defaulted to the operator login page regardless of who
  // actually signed out.
  describe('second pass — Entra/Defra ID redirecting back to /auth/logout with an already-empty session', () => {
    test('a regulator lands on the regulator login page, not the operator one', async () => {
      const yar = fakeYar()
      const h = mockH()
      const request = { yar, query: { userType: 'regulator' } }

      await logoutController(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
    })

    test('a regulator lands on the operator login page when regulator access is disabled', async () => {
      config.get.mockImplementation((key) =>
        key === 'auth.regulatorAccessDisabled' ? true : undefined
      )

      const yar = fakeYar()
      const h = mockH()
      const request = { yar, query: { userType: 'regulator' } }

      await logoutController(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
    })

    test('an operator lands on the operator login page', async () => {
      const yar = fakeYar()
      const h = mockH()
      const request = { yar, query: { userType: 'operator' } }

      await logoutController(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
    })

    test('an unrecognised userType value defaults to the operator login page rather than throwing', async () => {
      const yar = fakeYar()
      const h = mockH()
      const request = { yar, query: { userType: 'not-a-real-type' } }

      await logoutController(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
    })

    test('a direct visit with no userType query param at all defaults to operator', async () => {
      const yar = fakeYar()
      const h = mockH()
      const request = { yar, query: {} }

      await logoutController(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
    })
  })
})
