import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { TEST_USER, TEST_REGULATOR, TEST_OPERATOR } from './stub-auth-plugin.js'
import { requireRegulator, requireOperator } from './auth-scopes.js'

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
    const { statusCode } = await server.inject({ method: 'GET', url: '/' })
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
      await server.inject({ method: 'GET', url: '/test-scope-check' })
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
        headers: { 'x-test-user-type': 'operator' }
      })
      expect(captured).toMatchObject({ ...TEST_OPERATOR })
    })

    test('allows access to operator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-operator-only',
        headers: { 'x-test-user-type': 'operator' }
      })
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('rejects access to regulator routes', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-regulator-only',
        headers: { 'x-test-user-type': 'operator' }
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })
  })
})
