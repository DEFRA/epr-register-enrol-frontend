import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { TEST_USER } from './stub-auth-plugin.js'

describe('#stubAuthPlugin (test mode)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('auto-authenticates requests in test mode', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('populates request.auth.credentials with test user on protected routes', async () => {
    let capturedCredentials

    server.route({
      method: 'GET',
      path: '/test-auth-check',
      handler(request, h) {
        capturedCredentials = request.auth.credentials
        return h.response('ok').code(statusCodes.ok)
      }
    })

    await server.inject({ method: 'GET', url: '/test-auth-check' })

    expect(capturedCredentials).toEqual(TEST_USER)
  })
})
