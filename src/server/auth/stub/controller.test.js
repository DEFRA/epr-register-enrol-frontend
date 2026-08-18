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

  describe('Entra ID button visibility', () => {
    let entraServer

    beforeAll(async () => {
      vi.mocked(config.get).mockImplementation((key) => {
        if (key === 'auth.azureEntraId.clientId') return 'test-client-id'
        if (key === 'auth.azureEntraId.tenantId') {
          return 'Defradev.onmicrosoft.com'
        }
        return realConfigGet(key)
      })
      entraServer = await createServer()
      await entraServer.initialize()
    })

    afterAll(async () => {
      await entraServer?.stop({ timeout: 0 })
      // Restore to standard stub mock for any tests that run after this describe
      vi.mocked(config.get).mockImplementation((key) => {
        return realConfigGet(key)
      })
    })

    test('shows Entra ID button when credentials are configured for regulator', async () => {
      const { result, statusCode } = await entraServer.inject({
        method: 'GET',
        url: '/auth/stub/login?type=regulator'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="entra-id-login"')
    })

    test('does not show Entra ID button when credentials are absent for regulator', async () => {
      // Use the outer server (created without Entra ID config)
      // and temporarily restore the standard mock for this request
      vi.mocked(config.get).mockImplementation((key) => {
        return realConfigGet(key)
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login?type=regulator'
      })

      // Restore Entra ID mock for remaining tests in this block
      vi.mocked(config.get).mockImplementation((key) => {
        if (key === 'auth.azureEntraId.clientId') return 'test-client-id'
        if (key === 'auth.azureEntraId.tenantId') {
          return 'Defradev.onmicrosoft.com'
        }
        return realConfigGet(key)
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="entra-id-login"')
    })

    test('does not show Entra ID button for operator type', async () => {
      const { result, statusCode } = await entraServer.inject({
        method: 'GET',
        url: '/auth/stub/login?type=operator'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="entra-id-login"')
    })
  })

  describe('Defra ID route registration', () => {
    let defraIdServer

    beforeAll(async () => {
      vi.mocked(config.get).mockImplementation((key) => {
        if (key === 'auth.defraId.discoveryUrl') {
          return 'https://defra-id.example/.well-known/openid-configuration'
        }
        if (key === 'auth.defraId.clientId') return 'test-defra-client-id'
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
    test('renders chooser for regulator type', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login?type=regulator'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Stub Login')
      expect(result).toContain(STUB_USERS.regulator[0].name)
    })

    test('renders chooser for operator type', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login?type=operator'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Stub Login')
      expect(result).toContain(STUB_USERS.operator[0].name)
    })

    test('redirects to regulator login for unknown type', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/stub/login?type=unknown'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/auth/stub/login?type=regulator')
    })
  })

  describe('POST /auth/stub/login', () => {
    test('redirects to home on valid user selection', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: {
          userId: STUB_USERS.regulator[0].id,
          type: 'regulator'
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
          userId: 'nonexistent-user',
          type: 'regulator'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })

  describe('GET /auth/regulator/login stub chooser redirect', () => {
    test('redirects to the stub chooser without an rt param when none is supplied', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/regulator/login'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/auth/stub/login?type=regulator')
    })

    test('preserves an rt param, URL-encoded, on the stub chooser redirect', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/operator/login?rt=%2Faccreditation%2Ftask-list%2F123'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/auth/stub/login?type=operator&rt=%2Faccreditation%2Ftask-list%2F123'
      )
    })
  })
})
