import { describe, test, expect, vi, afterEach } from 'vitest'

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

const { operatorCallbackController } = await import('./controller.js')

// A session-fixation regression check: a pre-login session (with its own
// id, potentially seeded by an attacker who sent the victim a link) must be
// discarded — not reused — once a user actually authenticates. The
// callback controller must call yar.reset() before writing the
// authenticated user into the session, and must do so *after* any
// pre-login state (e.g. the stashed post-login redirect) has been read,
// otherwise that state would be wiped before it's used.
function fakeYar(initial = {}) {
  const store = new Map(Object.entries(initial))
  const calls = []
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      calls.push({ op: 'set', key })
      store.set(key, value)
    },
    clear: (key) => store.delete(key),
    reset: () => {
      calls.push({ op: 'reset' })
      store.clear()
    },
    _calls: calls
  }
}

function mockH() {
  return { redirect: vi.fn().mockReturnValue('redirected') }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('session fixation: reset() before writing the authenticated session', () => {
  test('operatorCallbackController resets the session before setting idToken and user', async () => {
    getDefraIdConfig.mockReturnValue({
      discoveryUrl: 'https://defra.example/.well-known/openid-configuration',
      scopes: ['openid'],
      clientId: 'defra-client-id',
      clientSecret: 'defra-secret',
      serviceId: 'service-id',
      callbackUrl: 'http://localhost:3000/auth/operator/callback'
    })
    getDefraIdEndpoints.mockResolvedValue({
      authUrl: 'https://defra.example/authorize',
      tokenUrl: 'https://defra.example/token',
      endSessionUrl: 'https://defra.example/end-session',
      jwksUri: 'https://defra.example/keys',
      issuer: 'https://defra.example'
    })
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

    const yar = fakeYar({
      oauthState: 'the-state',
      oauthNonce: 'the-nonce',
      pkceVerifier: 'the-verifier'
    })
    const request = {
      query: { code: 'auth-code', state: 'the-state' },
      yar,
      logger: { warn: vi.fn() }
    }

    await operatorCallbackController(request, mockH())

    const resetIndex = yar._calls.findIndex((c) => c.op === 'reset')
    const setIdTokenIndex = yar._calls.findIndex(
      (c) => c.op === 'set' && c.key === 'idToken'
    )
    const setUserIndex = yar._calls.findIndex(
      (c) => c.op === 'set' && c.key === 'user'
    )
    expect(resetIndex).toBeGreaterThanOrEqual(0)
    expect(setIdTokenIndex).toBeGreaterThan(resetIndex)
    expect(setUserIndex).toBeGreaterThan(resetIndex)
  })
})
