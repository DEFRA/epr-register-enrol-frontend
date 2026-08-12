import Boom from '@hapi/boom'
import { vi } from 'vitest'
import {
  redirectToLogin,
  confirmPostLoginRedirect,
  popPostLoginRedirect
} from './auth-redirect.js'
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
    test('stashes the originally requested GET URL, including query string, with a nonce', () => {
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
      const stashed = yar.get('postLoginRedirectOperator')
      expect(stashed.target).toBe('/organisations/123?foo=bar')
      expect(typeof stashed.nonce).toBe('string')
      expect(stashed.nonce.length).toBeGreaterThan(0)
    })

    test('carries the nonce in the login redirect query string', () => {
      const yar = fakeYar()
      const h = mockH()
      redirectToLogin(
        mockRequest(401, ['operator'], {
          method: 'get',
          path: '/organisations/123',
          url: { search: '' },
          yar
        }),
        h
      )
      const stashed = yar.get('postLoginRedirectOperator')
      expect(h.redirect).toHaveBeenCalledWith(
        `/auth/operator/login?rt=${stashed.nonce}`
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
      expect(yar.get('postLoginRedirectRegulator').target).toBe('/cases/123')
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

  describe('#confirmPostLoginRedirect', () => {
    test('keeps the stash when the request carries the matching nonce', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', { target: '/orgs/123', nonce: 'n1' })
      const request = { yar, query: { rt: 'n1' } }
      confirmPostLoginRedirect(request, 'operator')
      expect(yar.get('postLoginRedirectOperator')).toBeDefined()
    })

    test('drops the stash when the nonce is missing (a direct, unrelated visit)', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', { target: '/orgs/123', nonce: 'n1' })
      const request = { yar, query: {} }
      confirmPostLoginRedirect(request, 'operator')
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })

    test('drops the stash when the nonce does not match', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', { target: '/orgs/123', nonce: 'n1' })
      const request = { yar, query: { rt: 'wrong' } }
      confirmPostLoginRedirect(request, 'operator')
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })
  })

  describe('#popPostLoginRedirect', () => {
    test('returns and clears the stashed target for the given user type', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', {
        target: '/organisations/123',
        nonce: 'n1'
      })
      const request = { yar }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe(
        '/organisations/123'
      )
      expect(yar.get('postLoginRedirectOperator')).toBeUndefined()
    })

    test('does not leak a target stashed for a different user type', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectRegulator', {
        target: '/cases/123',
        nonce: 'n1'
      })
      const request = { yar }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe('/')
    })

    test('returns the fallback when nothing was stashed', () => {
      const request = { yar: fakeYar() }
      expect(popPostLoginRedirect(request, 'operator', '/')).toBe('/')
    })

    test('returns the fallback for a protocol-relative stashed value (open-redirect guard)', () => {
      const yar = fakeYar()
      yar.set('postLoginRedirectOperator', {
        target: '//evil.example',
        nonce: 'n1'
      })
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

    function extractCookies(headers) {
      const cookies = {}
      for (const header of headers['set-cookie'] ?? []) {
        const [pair] = header.split(';')
        const [key, value] = pair.split('=')
        cookies[key] = value
      }
      return cookies
    }

    function cookieHeader(cookies) {
      return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    }

    test('sends the user back to the originally requested URL after stub login', async () => {
      const loginRedirect = await server.inject({
        method: 'GET',
        url: '/test-requires-login?foo=bar'
      })
      expect(loginRedirect.statusCode).toBe(statusCodes.redirect)
      expect(loginRedirect.headers.location).toMatch(
        /^\/auth\/operator\/login\?rt=/
      )

      let cookies = extractCookies(loginRedirect.headers)
      expect(cookies.session).toBeTruthy()

      // Follow the redirect chain exactly as a browser would: GET the stub
      // chooser with the rt query string still attached, which is what
      // confirms the stash (see confirmPostLoginRedirect) before it can be
      // consumed. Built via URL/searchParams rather than string
      // concatenation, since the location already carries its own `?rt=`
      // — naively appending `?type=operator` would produce a second `?`
      // that hapi parses as part of the `type` value, silently skipping
      // confirmPostLoginRedirect and leaving this path uncovered.
      const rtUrl = new URL(loginRedirect.headers.location, 'http://localhost')
      const chooserUrl = new URL('/auth/stub/login', 'http://localhost')
      chooserUrl.searchParams.set('type', 'operator')
      chooserUrl.searchParams.set('rt', rtUrl.searchParams.get('rt'))

      const chooserPage = await server.inject({
        method: 'GET',
        url: chooserUrl.pathname + chooserUrl.search,
        headers: { cookie: cookieHeader(cookies) }
      })
      expect(chooserPage.statusCode).toBe(statusCodes.ok)
      cookies = { ...cookies, ...extractCookies(chooserPage.headers) }

      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        headers: { cookie: cookieHeader(cookies) },
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

    // Regression guard for the exact bug this caught in CI: a user is
    // bounced to login from a page they never actually sign in from (they
    // abandon it), then *separately* logs in later in the same browser
    // session — e.g. by navigating straight to /auth/operator/login. That
    // unrelated login must not silently resume the abandoned one.
    test('does not replay a stash from an abandoned login into a later, unrelated one', async () => {
      const loginRedirect = await server.inject({
        method: 'GET',
        url: '/test-requires-login?foo=bar'
      })
      const cookies = extractCookies(loginRedirect.headers)

      // The user never follows the rt-bearing redirect above — instead they
      // (or a later, separate action) land on the login page directly, with
      // no rt in the query string.
      const chooserPage = await server.inject({
        method: 'GET',
        url: '/auth/stub/login?type=operator',
        headers: { cookie: cookieHeader(cookies) }
      })
      const mergedCookies = {
        ...cookies,
        ...extractCookies(chooserPage.headers)
      }

      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        headers: { cookie: cookieHeader(mergedCookies) },
        payload: { userId: STUB_USERS.operator[0].id, type: 'operator' }
      })

      expect(stubLogin.headers.location).toBe('/')
    })

    test('does not replay a regulator-scoped stash into an operator login', async () => {
      const loginRedirect = await server.inject({
        method: 'GET',
        url: '/test-redirect-regulator?scope=1'
      })
      expect(loginRedirect.headers.location).toMatch(
        /^\/auth\/regulator\/login\?rt=/
      )
      const cookies = extractCookies(loginRedirect.headers)

      // Same session, but the user completes login as an operator instead —
      // must land on the operator default, not the stashed regulator path.
      const stubLogin = await server.inject({
        method: 'POST',
        url: '/auth/stub/login',
        headers: { cookie: cookieHeader(cookies) },
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
          'x-test-user-type': 'operator'
        }
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
