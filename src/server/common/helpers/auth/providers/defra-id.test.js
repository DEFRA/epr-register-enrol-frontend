import { describe, test, expect, vi, afterEach } from 'vitest'

// The module caches discovery results in a module-level variable, so each
// test gets a fresh module instance to avoid leaking that cache between
// tests (mirrors the pattern used by stub-api-client.test.js).
async function freshModule() {
  vi.resetModules()
  return import('./defra-id.js')
}

function fakeConfig(overrides = {}) {
  const values = {
    'auth.defraId.clientId': 'defra-client-id',
    'auth.defraId.clientSecret': 'defra-secret',
    'auth.defraId.discoveryUrl': 'https://defra.example/.well-known',
    'auth.defraId.serviceId': 'service-123',
    'auth.callbackBaseUrl': 'http://localhost:3000',
    ...overrides
  }
  return { get: (key) => values[key] }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('#getDefraIdConfig', () => {
  test('builds the provider config from the given config source', async () => {
    const { getDefraIdConfig } = await freshModule()

    const provider = getDefraIdConfig(fakeConfig())

    expect(provider).toEqual({
      discoveryUrl: 'https://defra.example/.well-known',
      scopes: ['openid', 'offline_access', 'defra-client-id'],
      clientId: 'defra-client-id',
      clientSecret: 'defra-secret',
      serviceId: 'service-123',
      callbackUrl: 'http://localhost:3000/auth/operator/callback'
    })
  })

  test('derives the callback URL from a different base URL', async () => {
    const { getDefraIdConfig } = await freshModule()

    const provider = getDefraIdConfig(
      fakeConfig({ 'auth.callbackBaseUrl': 'https://example.test' })
    )

    expect(provider.callbackUrl).toBe(
      'https://example.test/auth/operator/callback'
    )
  })
})

describe('#getDefraIdEndpoints', () => {
  test('fetches and maps the OIDC discovery document', async () => {
    const { getDefraIdEndpoints } = await freshModule()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://defra.example/authorize',
        token_endpoint: 'https://defra.example/token',
        end_session_endpoint: 'https://defra.example/end-session',
        jwks_uri: 'https://defra.example/keys',
        issuer: 'https://defra.example'
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const endpoints = await getDefraIdEndpoints(
      'https://defra.example/.well-known'
    )

    expect(endpoints).toEqual({
      authUrl: 'https://defra.example/authorize',
      tokenUrl: 'https://defra.example/token',
      endSessionUrl: 'https://defra.example/end-session',
      jwksUri: 'https://defra.example/keys',
      issuer: 'https://defra.example'
    })
    expect(fetchSpy).toHaveBeenCalledWith('https://defra.example/.well-known')
  })

  test('caches the discovery result across calls — only fetches once', async () => {
    const { getDefraIdEndpoints } = await freshModule()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://defra.example/authorize',
        token_endpoint: 'https://defra.example/token',
        end_session_endpoint: 'https://defra.example/end-session',
        jwks_uri: 'https://defra.example/keys',
        issuer: 'https://defra.example'
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const first = await getDefraIdEndpoints('https://defra.example/.well-known')
    const second = await getDefraIdEndpoints(
      'https://defra.example/.well-known'
    )

    expect(second).toBe(first)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('throws when the discovery request responds not-ok', async () => {
    const { getDefraIdEndpoints } = await freshModule()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    )

    await expect(
      getDefraIdEndpoints('https://defra.example/.well-known')
    ).rejects.toThrow('Defra ID OIDC discovery failed: 503')
  })
})
