import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'auth.callbackBaseUrl': 'https://frontend.example',
        'auth.azureEntraId.tenantId': 'the-tenant-id'
      }
      return values[key]
    })
  }
}))
vi.mock('../common/helpers/auth/providers/defra-id.js', () => ({
  getDefraIdConfig: vi.fn(),
  getDefraIdEndpoints: vi.fn()
}))

const { getDefraIdConfig, getDefraIdEndpoints } =
  await import('../common/helpers/auth/providers/defra-id.js')

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
})

describe('#logoutController federated logout', () => {
  test('regulator federated logout URL points at the tenant logout endpoint and carries the id_token', async () => {
    const yar = fakeYar({
      user: { userType: 'regulator', id: 'reg-1' },
      idToken: 'the-entra-id-token'
    })
    const h = mockH()
    const request = { yar }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledTimes(1)
    const [redirectUrl] = h.redirect.mock.calls[0]
    const url = new URL(redirectUrl)

    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/the-tenant-id/oauth2/v2.0/logout'
    )
    expect(url.searchParams.get('id_token_hint')).toBe('the-entra-id-token')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://frontend.example/auth/logout'
    )
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
    const request = { yar }

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
    const request = { yar }

    await logoutController(request, mockH())

    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  test('falls back to a plain local-session logout when there is no id_token', async () => {
    const yar = fakeYar({ user: { userType: 'regulator', id: 'reg-1' } })
    const h = mockH()
    const request = { yar }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })
})
