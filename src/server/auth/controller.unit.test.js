import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Every network/crypto-verification dependency of controller.js is mocked so
// these are pure unit tests of the branch logic — the real crypto/JWT paths
// are already exercised by defra-id-token.test.js,
// and the real end-to-end login/logout flow by controller.test.js.
vi.mock('../common/helpers/auth/providers/defra-id.js', () => ({
  getDefraIdConfig: vi.fn(),
  getDefraIdEndpoints: vi.fn()
}))
vi.mock('../common/helpers/auth/providers/defra-id-token.js', () => ({
  verifyDefraIdToken: vi.fn()
}))

const { getDefraIdConfig, getDefraIdEndpoints } =
  await import('../common/helpers/auth/providers/defra-id.js')
const { verifyDefraIdToken } =
  await import('../common/helpers/auth/providers/defra-id-token.js')

const {
  operatorLoginController,
  operatorCallbackController,
  logoutController
} = await import('./controller.js')

function fakeYar(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    clear: (key) => store.delete(key),
    reset: () => store.clear(),
    _store: store
  }
}

function mockH() {
  const h = {}
  h.redirect = vi.fn().mockReturnValue('redirected')
  h.view = vi.fn().mockReturnValue({
    code: vi.fn().mockReturnValue('viewed')
  })
  return h
}

const DEFRA_PROVIDER = {
  discoveryUrl: 'https://defra.example/.well-known/openid-configuration',
  scopes: ['openid', 'offline_access', 'defra-client-id'],
  clientId: 'defra-client-id',
  clientSecret: 'defra-secret',
  serviceId: 'service-id',
  callbackUrl: 'http://localhost:3000/auth/operator/callback'
}

const DEFRA_ENDPOINTS = {
  authUrl: 'https://defra.example/authorize',
  tokenUrl: 'https://defra.example/token',
  endSessionUrl: 'https://defra.example/end-session',
  jwksUri: 'https://defra.example/keys',
  issuer: 'https://defra.example'
}

beforeEach(() => {
  getDefraIdConfig.mockReturnValue(DEFRA_PROVIDER)
  getDefraIdEndpoints.mockResolvedValue(DEFRA_ENDPOINTS)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('#operatorLoginController', () => {
  test('discovers Defra ID endpoints and redirects to the authorize URL', async () => {
    const yar = fakeYar()
    const h = mockH()
    const request = { yar, query: {} }

    await operatorLoginController(request, h)

    expect(getDefraIdEndpoints).toHaveBeenCalledWith(
      DEFRA_PROVIDER.discoveryUrl
    )
    expect(yar.get('oauthState')).toBeTruthy()
    expect(yar.get('oauthNonce')).toBeTruthy()

    const [url] = h.redirect.mock.calls[0]
    expect(url.startsWith(`${DEFRA_ENDPOINTS.authUrl}?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe(DEFRA_PROVIDER.clientId)
    expect(params.get('serviceId')).toBe(DEFRA_PROVIDER.serviceId)
    expect(params.get('redirect_uri')).toBe(DEFRA_PROVIDER.callbackUrl)
    expect(params.get('state')).toBe(yar.get('oauthState'))
    expect(params.get('nonce')).toBe(yar.get('oauthNonce'))
  })
})

describe('#operatorCallbackController', () => {
  function makeRequest({ query, yarInitial } = {}) {
    return {
      query: query ?? { code: 'auth-code', state: 'the-state' },
      yar: fakeYar(
        yarInitial ?? {
          oauthState: 'the-state',
          oauthNonce: 'the-nonce',
          pkceVerifier: 'the-verifier'
        }
      ),
      logger: { warn: vi.fn() }
    }
  }

  test('redirects to login when code is missing', async () => {
    const h = mockH()
    const request = makeRequest({ query: { state: 'the-state' } })
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when state does not match', async () => {
    const h = mockH()
    const request = makeRequest({
      query: { code: 'auth-code', state: 'wrong' }
    })
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when nonce missing from session', async () => {
    const h = mockH()
    const request = makeRequest({ yarInitial: { oauthState: 'the-state' } })
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when the token endpoint returns non-2xx', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    )
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when the token endpoint request throws', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when the token response has no id_token', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    )
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('redirects to login when id_token verification fails', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'bad' })
      })
    )
    verifyDefraIdToken.mockRejectedValue(new Error('bad token'))
    await operatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('signs in an operator, stashes idToken, and redirects to default target', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyDefraIdToken.mockResolvedValue({
      sub: 'op-1',
      email: 'op@example.com',
      firstName: 'Opie',
      lastName: 'Rator',
      contactId: 'contact-1',
      currentRelationshipId: 'rel-1',
      relationships: ['rel-1'],
      roles: ['some-role']
    })

    await operatorCallbackController(request, h)

    expect(request.yar.get('idToken')).toBe('good-token')
    expect(request.yar.get('user')).toEqual({
      id: 'op-1',
      email: 'op@example.com',
      name: 'Opie Rator',
      contactId: 'contact-1',
      currentRelationshipId: 'rel-1',
      relationships: ['rel-1'],
      roles: ['some-role'],
      userType: 'operator'
    })
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  test('defaults name, relationships and roles when claims omit them', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyDefraIdToken.mockResolvedValue({ sub: 'op-2', email: 'x@x.com' })

    await operatorCallbackController(request, h)

    const user = request.yar.get('user')
    expect(user.name).toBe('')
    expect(user.relationships).toEqual([])
    expect(user.roles).toEqual([])
  })
})

describe('#logoutController federated (Defra ID) branch', () => {
  test('resets the session and redirects to the Defra ID end-session URL when an operator has an id_token', async () => {
    const h = mockH()
    const request = {
      query: {},
      yar: fakeYar({
        idToken: 'stored-id-token',
        user: { userType: 'operator' }
      })
    }

    await logoutController(request, h)

    expect(getDefraIdEndpoints).toHaveBeenCalledWith(
      DEFRA_PROVIDER.discoveryUrl
    )
    expect(request.yar.get('user')).toBeUndefined()
    const [url] = h.redirect.mock.calls[0]
    expect(url.startsWith(`${DEFRA_ENDPOINTS.endSessionUrl}?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('id_token_hint')).toBe('stored-id-token')
    expect(params.get('post_logout_redirect_uri')).toBe(
      'http://localhost:3000/auth/logout?userType=operator'
    )
  })

  // RA-537: regulator sign-in was removed. A return leg still carrying the
  // old `?userType=regulator` tag (an IdP round trip begun before deploy)
  // lands on the operator login page like any other value.
  test('a legacy userType=regulator return leg (empty session) lands on the operator login page', async () => {
    const h = mockH()
    const request = { query: { userType: 'regulator' }, yar: fakeYar() }

    await logoutController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
  })

  test('a leftover regulator session with an id_token logs out through Defra ID, not Entra ID', async () => {
    const h = mockH()
    const request = {
      query: {},
      yar: fakeYar({
        idToken: 'stored-id-token',
        user: { userType: 'regulator' }
      })
    }

    await logoutController(request, h)

    const [url] = h.redirect.mock.calls[0]
    expect(url.startsWith(`${DEFRA_ENDPOINTS.endSessionUrl}?`)).toBe(true)
    expect(new URL(url).searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:3000/auth/logout?userType=operator'
    )
  })
})
