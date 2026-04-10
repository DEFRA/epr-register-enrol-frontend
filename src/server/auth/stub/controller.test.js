import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { STUB_USERS } from './controller.js'

describe('#stubLoginController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
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
})
