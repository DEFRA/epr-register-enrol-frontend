import { vi } from 'vitest'
import { redirectToLogin } from './auth-redirect.js'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { requireRegulator, requireOperator } from './auth-scopes.js'

// --- Unit tests for the redirect logic ---

function mockRequest(statusCode, scope = []) {
  return {
    response: {
      isBoom: true,
      output: { statusCode }
    },
    route: {
      settings: {
        auth: scope.length
          ? { access: [{ scope: { selection: scope } }] }
          : { access: [] }
      }
    }
  }
}

function mockH() {
  const h = { continue: Symbol('continue') }
  h.redirect = vi.fn().mockReturnValue('redirected')
  return h
}

describe('#redirectToLogin', () => {
  describe('redirect logic (unit)', () => {
    test('redirects to operator login for a 401 on an operator-scoped route', () => {
      const h = mockH()
      redirectToLogin(mockRequest(401, ['operator']), h)
      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
    })

    test('redirects to regulator login for a 401 on a regulator-scoped route', () => {
      const h = mockH()
      redirectToLogin(mockRequest(401, ['regulator']), h)
      expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
    })

    test('redirects to regulator login for a 401 with no scope (default)', () => {
      const h = mockH()
      redirectToLogin(mockRequest(401), h)
      expect(h.redirect).toHaveBeenCalledWith('/auth/regulator/login')
    })

    test('does not redirect for a 403 — returns h.continue', () => {
      const h = mockH()
      const result = redirectToLogin(mockRequest(403, ['regulator']), h)
      expect(h.redirect).not.toHaveBeenCalled()
      expect(result).toBe(h.continue)
    })

    test('does not redirect for non-boom responses', () => {
      const h = mockH()
      const request = { response: { isBoom: false } }
      const result = redirectToLogin(request, h)
      expect(h.redirect).not.toHaveBeenCalled()
      expect(result).toBe(h.continue)
    })
  })

  // --- Integration tests: scope enforcement via the running server ---

  describe('scope enforcement (integration)', () => {
    let server

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()

      server.route([
        {
          method: 'GET',
          path: '/test-redirect-regulator',
          options: requireRegulator,
          handler: (request, h) => h.response('ok').code(statusCodes.ok)
        },
        {
          method: 'GET',
          path: '/test-redirect-operator',
          options: requireOperator,
          handler: (request, h) => h.response('ok').code(statusCodes.ok)
        }
      ])
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('operator cannot access a regulator route — receives 403, not a redirect', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-redirect-regulator',
        headers: { 'x-test-user-type': 'operator' }
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('regulator cannot access an operator route — receives 403, not a redirect', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-redirect-operator'
        // default test user is regulator
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })
  })
})
