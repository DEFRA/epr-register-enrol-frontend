import Boom from '@hapi/boom'
import { vi } from 'vitest'
import { redirectToLogin, popPostLoginRedirect } from './auth-redirect.js'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants/status-codes.js'
import { requireRegulator, requireOperator } from './auth-scopes.js'
import { config } from '../../../../config/config.js'
import { STUB_USERS } from '../../../auth/stub/controller.js'

// --- Unit tests for the redirect logic ---

function fakeYar() {
  const store = new Map()
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    clear: (key) => store.delete(key)
  }
}

function mockRequest(statusCode, scope = [], overrides = {}) {
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
    },
    ...overrides
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

    test('redirects to operator login for a 401 with no scope (default)', () => {
      const h = mockH()
      redirectToLogin(mockRequest(401), h)
      expect(h.redirect).toHaveBeenCalledWith('/auth/operator/login')
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

  describe('post-login redirect stashing', () => {
    test('stashes the originally requested GET URL, including query string', () => {
      const yar = fakeYar()
      const h = mockH()
      redirectToLogin(
        mockRequest(401, ['operator'], {
          method: 'get',
          path: '/organisations/123',
          url: { search: '?foo=bar' },
          yar
        }),
        h
      )
      expect(yar.get('postLoginRedirectOperator')).toBe(
        '/organisations/123?foo=bar'
      )
    })

    test('stashes under a separate key per user type', () => {
      const yar = fakeYar()
      const h = mockH()
      redirectToLogin(
        mockRequest(401, ['regulator'], {
          method: 'get',
          path: '/cases/123',
          url: { search: '' },
          yar
        }),
        h
      )
      expect(yar.get('postLoginRedirectRegulator')).toBe('/cases/123')
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })

    test('does not stash a non-GET request', () => {
      const yar = fakeYar()
      const h = mockH()
      redirectToLogin(
        mockRequest(401, ['operator'], {
          method: 'post',
          path: '/organisations/123',
          url: { search: '' },
          yar
        }),
        h
      )
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })

    test('does not stash a request for an /auth/* path', () => {
      const yar = fakeYar()
      const h = mockH()
      redirectToLogin(
        mockRequest(401, ['operator'], {
          method: 'get',
          path: '/auth/operator/login',
          url: { search: '' },
          yar
        }),
        h
      )
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })
  })

  describe('#popPostLoginRedirect', () => {
    test('returns and clears the stashed target for the given user type', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', '/organisations/123')
      const request = { yar }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe(
        '/organisations/123'
      )
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })

    test('does not leak a target stashed for a different user type', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectRegulator', '/cases/123')
      const request = { yar }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe('/')
    })

    test('returns the fallback when nothing was stashed', () => {
      const request = { yar: fakeYar() }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe('/')
    })

    test('returns the fallback for a protocol-relative stashed value (open-redirect guard)', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', '//evil.example')
      const request = { yar }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe('/')
    })
  })

  // --- Integration test: the full 401 -> login -> redirect-back round trip
  // through the real running server (real yar session, real cookies). This
  // is the case a mocked-yar unit test can't catch: the stash only survives
  // if redirectToLogin's onPreResponse handler runs, and commits, *before*
  // yar's own onPreResponse commit handler — an ordering determined by
  // plugin registration order in server.js, not by anything in this file.
  describe('post-login redirect (end-to-end)', () => {
    let server

    beforeAll(async () => {
      server = await createServer()

      server.route([
        {
          method: 'GET',
          path: '/test-requires-login',
          options: { auth: false },
          handler: () => {
            throw Boom.unauthorized(null, 'session')
          }
        },
        {
          method: 'GET',
          path: '/test-redirect-regulator',
          options: requireRegulator,
          handler: () => {
            throw Boom.unauthorized(null, 'session')
          }
        }
      ])

      await server.initialize()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    function extractCookie(headers) {
      return (headers['set-cookie'] ?? [])
        .map((c) => c.split(';')[0])
        .join('; ')
    }

    test('sends the user back to the originally requested URL after stub login', async () => {
      const loginRedirect = await server.inject({
        method: 'GET',
        url: '/test-requires-login?foo=bar'
      })
      expect(loginRedirect.statusCode).toBe(statusCodes.redirect)
      expect(loginRedirect.headers.location).toBe('/auth/operator/login')

      const cookie = extractCookie(loginRedirect.headers)
      expect(cookie).toContain('session=')

      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        headers: { cookie },
        payload: { userId: STUB_USERS.operator[0].id, type: 'operator' }
      })

      expect(stubLogin.statusCode).toBe(statusCodes.redirect)
      expect(stubLogin.headers.location).toBe('/test-requires-login?foo=bar')
    })

    test('falls back to "/" when the user navigates to login directly', async () => {
      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        payload: { userId: STUB_USERS.operator[0].id, type: 'operator' }
      })

      expect(stubLogin.statusCode).toBe(statusCodes.redirect)
      expect(stubLogin.headers.location).toBe('/')
    })

    test('does not replay a regulator-scoped stash into an operator login', async () => {
      const loginRedirect = await server.inject({
        method: 'GET',
        url: '/test-redirect-regulator?scope=1'
      })
      expect(loginRedirect.headers.location).toBe('/auth/regulator/login')
      const cookie = extractCookie(loginRedirect.headers)

      // Same session, but the user completes login as an operator instead —
      // must land on the operator default, not the stashed regulator path.
      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        headers: { cookie },
        payload: { userId: STUB_USERS.operator[0].id, type: 'operator' }
      })

      expect(stubLogin.headers.location).toBe('/')
    })
  })

  // --- Integration tests: scope enforcement via the running server ---

  describe('scope enforcement (integration)', () => {
    let server

    beforeAll(async () => {
      const originalGet = config.get.bind(config)
      vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'auth.basicEnabled') return false
        return originalGet(key)
      })
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
        headers: {
          'x-test-user-type': 'operator',
          Authorization: 'Basic dGVzdDp0ZXN0MTIz'
        }
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })

    test('regulator cannot access an operator route — receives 403, not a redirect', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/test-redirect-operator',
        headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
        // default test user is regulator
      })
      expect(statusCode).toBe(statusCodes.forbidden)
    })
  })
})
