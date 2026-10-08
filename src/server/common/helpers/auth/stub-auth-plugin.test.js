import { vi } from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { TEST_OPERATOR } from './stub-auth-plugin.js'
import { requireOperator } from './auth-scopes.js'

describe('#stubAuthPlugin (test mode)', () => {
  let server
  let captured

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()

    server.route([
      {
        method: 'GET',
        path: '/test-operator-only',
        options: requireOperator,
        handler: (request, h) => h.response('ok').code(statusCodes.ok)
      },
      {
        method: 'GET',
        path: '/test-scope-check',
        handler(request, h) {
          captured = request.auth.credentials
          return h.response('ok').code(statusCodes.ok)
        }
      }
    ])
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    captured = undefined
  })

  test('auto-authenticates requests in test mode as TEST_OPERATOR', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/test-scope-check'
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(captured).toMatchObject({ ...TEST_OPERATOR })
  })

  test('allows access to operator routes without any x-test-user-type header', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/test-operator-only'
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  // RA-537: the regulator user type was removed, so the header no longer
  // selects anything — any value, including the retired 'regulator', still
  // authenticates as the operator.
  test.each(['operator', 'regulator', 'not-a-real-user-type'])(
    'authenticates as TEST_OPERATOR with x-test-user-type: %s',
    async (userType) => {
      await server.inject({
        method: 'GET',
        url: '/test-scope-check',
        headers: { 'x-test-user-type': userType }
      })
      expect(captured).toMatchObject({ ...TEST_OPERATOR })
    }
  )
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

  test('builds scope from the session user type', async () => {
    const authenticate = await getYarSessionAuthenticate()
    const user = { userType: 'operator' }
    const request = {
      yar: { get: vi.fn().mockReturnValue(user), set: vi.fn() }
    }
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
