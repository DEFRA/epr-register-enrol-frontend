import hapi from '@hapi/hapi'
import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest'

import { statusCodes } from '../../constants/status-codes.js'

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn() }
}))

const { config } = await import('../../../../config/config.js')
const { basicAuthPlugin } = await import('./basic-auth-plugin.js')

const validAuthHeader =
  'Basic ' + Buffer.from('test:test123').toString('base64')

const makeServer = async () => {
  const server = hapi.server()
  await server.register(basicAuthPlugin)
  server.route({
    method: 'GET',
    path: '/test',
    options: { auth: false },
    handler: () => 'ok'
  })
  await server.initialize()
  return server
}

describe('#basicAuthPlugin', () => {
  describe('when basicEnabled is true', () => {
    let server

    beforeAll(async () => {
      config.get.mockImplementation((key) => {
        if (key === 'auth.basicEnabled') return true
        if (key === 'auth.basicUsr') return 'test'
        if (key === 'auth.basicPasswd') return 'test123'
      })
      server = await makeServer()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('returns 401 with WWW-Authenticate when no Authorization header', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/test'
      })
      expect(statusCode).toBe(statusCodes.unauthorized)
      expect(headers['www-authenticate']).toBe('Basic realm="Application"')
    })

    test('returns 401 when Authorization header is not Basic scheme', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer sometoken' }
      })
      expect(statusCode).toBe(statusCodes.unauthorized)
    })

    test('returns 401 for unknown username', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization:
            'Basic ' + Buffer.from('nobody:test123').toString('base64')
        }
      })
      expect(statusCode).toBe(statusCodes.unauthorized)
    })

    test('returns 401 for wrong password', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization:
            'Basic ' + Buffer.from('test:wrongpassword').toString('base64')
        }
      })
      expect(statusCode).toBe(statusCodes.unauthorized)
    })

    test('allows request through with valid credentials', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: validAuthHeader }
      })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('when basicEnabled is false', () => {
    let server

    beforeAll(async () => {
      config.get.mockImplementation((key) => {
        if (key === 'auth.basicEnabled') return false
      })
      server = await makeServer()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('allows requests through without any Authorization header', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test'
      })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
