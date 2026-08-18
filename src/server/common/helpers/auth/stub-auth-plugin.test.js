import { vi } from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { TEST_USER, TEST_REGULATOR, TEST_OPERATOR } from './stub-auth-plugin.js'
import { requireRegulator, requireOperator } from './auth-scopes.js'
import { ROLE_REGULATOR_STANDARD } from './auth-scopes.js'

describe('#stubAuthPlugin (test mode)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()

    server.route([
      {
        method: 'GET',
        path: '/test-regulator-only',
        options: requireRegulator,
        handler: (request, h) => h.response('ok').code(statusCodes.ok)
      },
      {
        method: 'GET',
        path: '/test-operator-only',
        options: requireOperator,
        handler: (request, h) => h.response('ok').code(statusCodes.ok)
      }
    ])
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('auto-authenticates requests in test mode', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/test-regulator-only'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('TEST_USER is the default regulator', () => {
    expect(TEST_USER).toBe(TEST_REGULATOR)
  })

  describe('default user type (regulator)', () => {
    test('populates credentials with regulator scope', async () => {
      let captured
      server.route({
        method: 'GET',
        path: '/test-scope-check',
        handler(request, h) {
          captured = request.auth.credentials
          return h.response('ok').code(statusCodes.ok)
        }
      })
      await server.inject({
        method: 'GET',
        url: '/test-scope-check'
      })
      expect(captured).toMatchObject({ ...TEST_REGULATOR })
    })

    test('allows access to regulator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-regulator-only'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('rejects access to operator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-operator-only'
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })
  })

  describe('with x-test-user-type: operator header', () => {
    test('populates credentials with operator scope', async () => {
      let captured
      server.route({
        method: 'GET',
        path: '/test-operator-scope-check',
        handler(request, h) {
          captured = request.auth.credentials
          return h.response('ok').code(statusCodes.ok)
        }
      })
      await server.inject({
        method: 'GET',
        url: '/test-operator-scope-check',
        headers: {
          'x-test-user-type': 'operator'
        }
      })
      expect(captured).toMatchObject({ ...TEST_OPERATOR })
    })

    test('allows access to operator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-operator-only',
        headers: {
          'x-test-user-type': 'operator'
        }
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('rejects access to regulator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-regulator-only',
        headers: {
          'x-test-user-type': 'operator'
        }
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })
  })

  describe('with an unrecognised x-test-user-type header', () => {
    test('falls back to the default regulator user', async () => {
      let captured
      server.route({
        method: 'GET',
        path: '/test-unknown-user-type-scope-check',
        handler(request, h) {
          captured = request.auth.credentials
          return h.response('ok').code(statusCodes.ok)
        }
      })
      await server.inject({
        method: 'GET',
        url: '/test-unknown-user-type-scope-check',
        headers: {
          'x-test-user-type': 'not-a-real-user-type'
        }
      })
      expect(captured).toMatchObject({ ...TEST_REGULATOR })
    })
  })
})

describe('#stubAuthPlugin (stub/local-dev mode)', () => {
  // config.isTest is always true under Vitest, so the yar-session branch
  // (used for local dev without the test-bypass scheme) is exercised here
  // by mocking config directly and calling the plugin's register() against
  // a minimal fake server, rather than through a real createServer().
  async function loadPluginWithIsTestFalse() {
    vi.resetModules()
    vi.doMock('../../../../config/config.js', () => ({
      config: { get: (key) => (key === 'isTest' ? false : undefined) }
    }))
    return import('./stub-auth-plugin.js')
  }

  afterEach(() => {
    vi.doUnmock('../../../../config/config.js')
  })

  test('registers the yar-session scheme instead of test-bypass', async () => {
    const { stubAuthPlugin } = await loadPluginWithIsTestFalse()

    let registeredScheme
    const fakeServer = {
      auth: {
        scheme: vi.fn((name) => {
          registeredScheme = name
        }),
        strategy: vi.fn(),
        default: vi.fn()
      },
      ext: vi.fn()
    }

    await stubAuthPlugin.plugin.register(fakeServer)

    expect(registeredScheme).toBe('yar-session')
    expect(fakeServer.auth.strategy).toHaveBeenCalledWith(
      'session',
      'yar-session'
    )
  })

  async function getYarSessionAuthenticate() {
    const { stubAuthPlugin } = await loadPluginWithIsTestFalse()
    let schemeFactory
    const fakeServer = {
      auth: {
        scheme: vi.fn((_name, factory) => {
          schemeFactory = factory
        }),
        strategy: vi.fn(),
        default: vi.fn()
      },
      ext: vi.fn()
    }
    await stubAuthPlugin.plugin.register(fakeServer)
    return schemeFactory().authenticate
  }

  test('rejects as unauthenticated when there is no user in the session', async () => {
    const authenticate = await getYarSessionAuthenticate()
    const request = { yar: { get: vi.fn().mockReturnValue(undefined) } }
    const h = { unauthenticated: vi.fn((v) => v), authenticated: vi.fn() }

    authenticate(request, h)

    expect(h.unauthenticated).toHaveBeenCalled()
    expect(h.authenticated).not.toHaveBeenCalled()
  })

  test('adds the regulatorRole to scope when the session user has one', async () => {
    const authenticate = await getYarSessionAuthenticate()
    const user = {
      userType: 'regulator',
      regulatorRole: ROLE_REGULATOR_STANDARD
    }
    const request = { yar: { get: vi.fn().mockReturnValue(user) } }
    const h = { unauthenticated: vi.fn(), authenticated: vi.fn((v) => v) }

    authenticate(request, h)

    expect(h.authenticated).toHaveBeenCalledWith({
      credentials: {
        ...user,
        scope: ['regulator', ROLE_REGULATOR_STANDARD]
      }
    })
  })

  test('omits the regulatorRole from scope when the session user has none', async () => {
    const authenticate = await getYarSessionAuthenticate()
    const user = { userType: 'operator' }
    const request = { yar: { get: vi.fn().mockReturnValue(user) } }
    const h = { unauthenticated: vi.fn(), authenticated: vi.fn((v) => v) }

    authenticate(request, h)

    expect(h.authenticated).toHaveBeenCalledWith({
      credentials: {
        ...user,
        scope: ['operator']
      }
    })
  })
})
