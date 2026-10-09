import { describe, test, expect, vi, afterEach } from 'vitest'

function defaultConfigGet(key) {
  const values = {
    'auth.callbackBaseUrl': 'https://frontend.example'
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
// otherwise the user stays silently signed in to Defra ID and a subsequent
// login bounces straight back in via SSO.
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
    const resetSpy = vi.spyOn(yar, 'reset')
    const request = { yar, query: {} }

    await logoutController(request, mockH())

    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  test('falls back to a plain local-session logout when there is no id_token', async () => {
    const yar = fakeYar({ user: { userType: 'operator', id: 'op-1' } })
    const h = mockH()
    const request = { yar, query: {} }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  // On the round trip back from a federated logout, `user` has already been
  // reset by the first pass — the request that hits this route as Defra
  // ID's callback has no session at all. Every return leg lands on the
  // operator login page, the only login this service has.
  describe('second pass — Defra ID redirecting back to /auth/logout with an already-empty session', () => {
    test('a legacy userType=regulator return leg lands on the operator login page', async () => {
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
