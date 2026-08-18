import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import { statusCodes } from '../common/constants/status-codes.js'
import { ROLE_REGULATOR_STANDARD } from '../common/helpers/auth/auth-scopes.js'

// Every network/crypto-verification dependency of controller.js is mocked so
// these are pure unit tests of the branch logic — the real crypto/JWT paths
// are already exercised by defra-id-token.test.js / azure-id-token.test.js,
// and the real end-to-end login/logout flow by controller.test.js.
vi.mock('../common/helpers/auth/providers/azure-entra-id.js', () => ({
  getAzureEntraIdConfig: vi.fn()
}))
vi.mock('../common/helpers/auth/providers/defra-id.js', () => ({
  getDefraIdConfig: vi.fn(),
  getDefraIdEndpoints: vi.fn()
}))
vi.mock('../common/helpers/auth/providers/azure-id-token.js', () => ({
  verifyAzureIdToken: vi.fn()
}))
vi.mock('../common/helpers/auth/providers/defra-id-token.js', () => ({
  verifyDefraIdToken: vi.fn()
}))

const { getAzureEntraIdConfig } =
  await import('../common/helpers/auth/providers/azure-entra-id.js')
const { getDefraIdConfig, getDefraIdEndpoints } =
  await import('../common/helpers/auth/providers/defra-id.js')
const { verifyAzureIdToken } =
  await import('../common/helpers/auth/providers/azure-id-token.js')
const { verifyDefraIdToken } =
  await import('../common/helpers/auth/providers/defra-id-token.js')

const {
  regulatorLoginController,
  operatorLoginController,
  regulatorCallbackController,
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

const AZURE_PROVIDER = {
  authUrl: 'https://login.microsoftonline.com/tenant/authorize',
  tokenUrl: 'https://login.microsoftonline.com/tenant/token',
  jwksUri: 'https://login.microsoftonline.com/tenant/keys',
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  scopes: ['openid', 'profile', 'email'],
  clientId: 'azure-client-id',
  clientSecret: 'azure-secret',
  callbackUrl: 'http://localhost:3000/auth/regulator/callback'
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
  getAzureEntraIdConfig.mockReturnValue(AZURE_PROVIDER)
  getDefraIdConfig.mockReturnValue(DEFRA_PROVIDER)
  getDefraIdEndpoints.mockResolvedValue(DEFRA_ENDPOINTS)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('#regulatorLoginController', () => {
  test('stashes state/nonce/pkce and redirects to the Azure authorize URL', () => {
    const yar = fakeYar()
    const h = mockH()
    const request = { yar, query: {} }

    regulatorLoginController(request, h)

    expect(yar.get('oauthState')).toBeTruthy()
    expect(yar.get('oauthNonce')).toBeTruthy()
    expect(yar.get('pkceVerifier')).toBeTruthy()

    expect(h.redirect).toHaveBeenCalledTimes(1)
    const [url] = h.redirect.mock.calls[0]
    expect(url.startsWith(`${AZURE_PROVIDER.authUrl}?`)).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('client_id')).toBe(AZURE_PROVIDER.clientId)
    expect(params.get('response_type')).toBe('code')
    expect(params.get('redirect_uri')).toBe(AZURE_PROVIDER.callbackUrl)
    expect(params.get('scope')).toBe(AZURE_PROVIDER.scopes.join(' '))
    expect(params.get('state')).toBe(yar.get('oauthState'))
    expect(params.get('nonce')).toBe(yar.get('oauthNonce'))
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('code_challenge')).toBeTruthy()
  })
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

describe('#regulatorCallbackController', () => {
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
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('redirects to login when state does not match', async () => {
    const h = mockH()
    const request = makeRequest({
      query: { code: 'auth-code', state: 'wrong-state' }
    })
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
    expect(request.logger.warn).toHaveBeenCalled()
  })

  test('clears the stashed oauth values once state has been checked', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400 })
    )
    await regulatorCallbackController(request, h)
    expect(request.yar.get('oauthState')).toBeUndefined()
    expect(request.yar.get('oauthNonce')).toBeUndefined()
    expect(request.yar.get('pkceVerifier')).toBeUndefined()
  })

  test('redirects to login when nonce or pkce verifier missing from session', async () => {
    const h = mockH()
    const request = makeRequest({
      yarInitial: { oauthState: 'the-state' }
    })
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('redirects to login when the token endpoint returns non-2xx', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400 })
    )
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('redirects to login when the token endpoint request throws', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('redirects to login when the token response has no id_token', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'x' })
      })
    )
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('redirects to login when id_token verification fails', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'bad-token' })
      })
    )
    verifyAzureIdToken.mockRejectedValue(new Error('bad signature'))
    await regulatorCallbackController(request, h)
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })

  test('returns access-denied 403 when the caller has neither regulator role', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyAzureIdToken.mockResolvedValue({ sub: 'u1', roles: ['SomeOther'] })

    const result = await regulatorCallbackController(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error/access-denied',
      expect.objectContaining({ pageTitle: expect.any(String) })
    )
    expect(h.view.mock.results[0].value.code).toHaveBeenCalledWith(
      statusCodes.forbidden
    )
    expect(result).toBe('viewed')
  })

  test('signs in a standard regulator and redirects to the default target', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyAzureIdToken.mockResolvedValue({
      oid: 'oid-1',
      preferred_username: 'reg@example.com',
      name: 'Reg User',
      roles: ['Waste.Regulator.Standard']
    })

    await regulatorCallbackController(request, h)

    const user = request.yar.get('user')
    expect(user).toEqual({
      id: 'oid-1',
      email: 'reg@example.com',
      name: 'Reg User',
      userType: 'regulator',
      regulatorRole: ROLE_REGULATOR_STANDARD
    })
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  test('signs in a support read-only regulator', async () => {
    const h = mockH()
    const request = makeRequest()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyAzureIdToken.mockResolvedValue({
      sub: 'sub-1',
      roles: ['Waste.SupportUser.ReadOnly']
    })

    await regulatorCallbackController(request, h)

    const user = request.yar.get('user')
    expect(user.regulatorRole).toBe('regulator-support-readonly')
    expect(user.id).toBe('sub-1')
    expect(user.email).toBeNull()
    expect(user.name).toBeNull()
  })

  test('falls back to email claim and stashed redirect target when preferred_username absent', async () => {
    const h = mockH()
    const request = makeRequest()
    request.yar.set('postLoginRedirectRegulator', {
      target: '/cases/42',
      nonce: 'n1'
    })
    request.query.rt = 'n1'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id_token: 'good-token' })
      })
    )
    verifyAzureIdToken.mockResolvedValue({
      sub: 'sub-2',
      email: 'fallback@example.com',
      roles: ['Waste.Regulator.Standard']
    })

    await regulatorCallbackController(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/cases/42')
  })
})

describe('#operatorCallbackController', () => {
  function makeRequest({ query, yarInitial } = {}) {
    return {
      query: query ?? { code: 'auth-code', state: 'the-state' },
      yar: fakeYar(
        yarInitial ?? {
          oauthState: 'the-state',
          oauthNonce: 'the-nonce'
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
      'http://localhost:3000/auth/logout'
    )
  })

  test('does not federate logout for a regulator, even with an id_token present', async () => {
    const h = mockH()
    const request = {
      yar: fakeYar({
        idToken: 'stored-id-token',
        user: { userType: 'regulator' }
      })
    }

    await logoutController(request, h)

    expect(getDefraIdEndpoints).not.toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
  })
})
