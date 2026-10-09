import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { STUB_USERS } from './controller.js'
import { config } from '../../../config/config.js'

// Capture the real config.get before any spy wraps it
const realConfigGet = config.get.bind(config)

describe('#stubLoginController', () => {
  let server

  beforeAll(async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      return realConfigGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  // RA-537: the regulator side of the app (and its Entra ID sign-in) was
  // removed — the chooser only offers operators, and every regulator login
  // entry point is gone rather than merely hidden.
  describe('regulator login removed', () => {
    test('chooser offers no regulator login, switch link or Entra ID button', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('type=regulator')
      expect(result).not.toContain('Switch to')
      expect(result).not.toContain('data-testid="entra-id-login"')
      expect(result).not.toMatch(/regulator/i)
    })

    test('POST with the old regulator stub user does not sign anyone in', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: { userId: 'stub-reg-1' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(headers.location).toBeUndefined()
    })

    test.each([
      '/auth/regulator/login',
      '/auth/regulator/entra-id',
      '/auth/regulator/callback'
    ])('%s is not registered (404)', async (url) => {
      const { statusCode } = await server.inject({ method: 'GET', url })

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('STUB_USERS only has operators', () => {
      expect(STUB_USERS.map((u) => u.userType)).toEqual(['operator'])
    })
  })

  describe('Defra ID route registration', () => {
    let defraIdServer

    beforeAll(async () => {
      vi.mocked(config.get).mockImplementation((key) => {
        if (key === 'auth.defraId.discoveryUrl') {
          return 'https://defra-id.example/.well-known/openid-configuration'
        }
        if (key === 'auth.defraId.clientId') {
          return 'test-defra-client-id'
        }
        return realConfigGet(key)
      })
      defraIdServer = await createServer()
      await defraIdServer.initialize()
    })

    afterAll(async () => {
      await defraIdServer?.stop({ timeout: 0 })
      vi.mocked(config.get).mockImplementation((key) => {
        return realConfigGet(key)
      })
    })

    test('registers /auth/operator/defra-id when Defra ID credentials are configured', async () => {
      const { statusCode } = await defraIdServer.inject({
        method: 'GET',
        url: '/auth/operator/defra-id'
      })

      expect(statusCode).not.toBe(statusCodes.notFound)
    })

    test('does not register /auth/operator/defra-id when Defra ID credentials are absent', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/operator/defra-id'
      })

      expect(statusCode).toBe(statusCodes.notFound)
    })
  })

  describe('GET /auth/stub/login', () => {
    test('renders the operator chooser', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Stub Login')
      expect(result).toContain('Select an operator user')
      expect(result).toContain(STUB_USERS[0].name)
      expect(result).not.toContain('name="type"')
    })

    // Older links and bookmarks still carry a `type` param; it is accepted
    // and ignored rather than redirected or rejected.
    test.each(['operator', 'regulator', 'unknown', 'constructor'])(
      'renders the same operator chooser for a leftover type=%s param',
      async (type) => {
        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: `/auth/stub/login?type=${type}`
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('Select an operator user')
        expect(result).toContain(STUB_USERS[0].name)
      }
    )
  })

  describe('POST /auth/stub/login', () => {
    test('redirects to home on valid user selection', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: {
          userId: STUB_USERS[0].id
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/')
    })

    test('returns 400 for invalid user selection', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: {
          userId: 'nonexistent-user'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('returns 400 when no userId is posted', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })

  describe('GET /auth/operator/login stub chooser redirect', () => {
    test('redirects to the stub chooser without an rt param when none is supplied', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/operator/login'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/auth/stub/login')
    })

    test('preserves an rt param, URL-encoded, on the stub chooser redirect', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/operator/login?rt=%2Faccreditation%2Ftask-list%2F123'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/auth/stub/login?rt=%2Faccreditation%2Ftask-list%2F123'
      )
    })
  })
})
