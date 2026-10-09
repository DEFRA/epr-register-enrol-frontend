import hapi from '@hapi/hapi'
import Yar from '@hapi/yar'
import { load } from 'cheerio'

import { config } from '../../config/config.js'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { authPlugin } from '../common/helpers/auth/auth-plugin.js'
import { nunjucksConfig } from '../../config/nunjucks/nunjucks.js'
import {
  consentCookie,
  decodeConsentSetCookie
} from '../common/test-helpers/analytics-consent.js'
import { ANALYTICS_CONSENT_VERSION } from '../common/analytics/consent.js'
import { cookies } from './index.js'
import { safeReturnUrl } from './consent-controller.js'

const original = {
  isEnabled: config.get('analytics.isEnabled'),
  measurementId: config.get('analytics.measurementId')
}

function enableAnalytics() {
  config.set('analytics.isEnabled', true)
  config.set('analytics.measurementId', 'G-TEST')
}

function restoreAnalytics() {
  config.set('analytics.isEnabled', original.isEnabled)
  config.set('analytics.measurementId', original.measurementId)
}

function setCookies(res) {
  return [].concat(res.headers['set-cookie'] ?? [])
}

function setCookieFor(res, name) {
  return setCookies(res).find((header) => header.startsWith(`${name}=`))
}

/** The `name=value` pairs a browser would send back after this response. */
function cookieHeaderFrom(res) {
  return setCookies(res)
    .map((header) => header.split(';')[0])
    .join('; ')
}

// CSRF validation is skipped in test mode (see server.js), so no crumb is
// needed here.
function postConsent(server, payload, opts = {}) {
  return server.inject({
    method: 'POST',
    url: '/cookies/consent',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...opts.headers
    },
    payload: new URLSearchParams(payload).toString()
  })
}

describe('cookies routes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    restoreAnalytics()
  })

  test('every cookies route is reachable signed out but still picks up a session', () => {
    const routes = server
      .table()
      .filter((route) => route.path.includes('cookies'))
      .map((route) => ({
        key: `${route.method.toUpperCase()} ${route.path}`,
        mode: route.settings.auth?.mode
      }))

    expect(routes).toEqual(
      expect.arrayContaining([
        { key: 'GET /cookies', mode: 'try' },
        { key: 'GET /{language}/cookies', mode: 'try' },
        { key: 'POST /cookies/consent', mode: 'try' }
      ])
    )
  })

  describe('GET /cookies', () => {
    test('lists the essential cookies and keeps the signed-in navigation', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/cookies'
      })
      const $ = load(res.result)

      expect(res.statusCode).toBe(statusCodes.ok)
      expect($('title').text()).toContain('Cookies |')
      expect($('[data-testid="nav-sign-out-link"]')).toHaveLength(1)

      const names = $('[data-testid="essential-cookies"] tbody tr')
        .map((_i, row) => $(row).find('td, th').first().text().trim())
        .get()
      expect(names).toEqual(['crumb', 'session', 'analyticsConsent'])
    })

    test('hides the analytics section when analytics is off', async () => {
      const res = await server.inject({ method: 'GET', url: '/cookies' })
      const $ = load(res.result)

      expect($('[data-testid="analytics-cookies"]')).toHaveLength(0)
      expect($('[data-testid="cookies-form"]')).toHaveLength(0)
    })

    describe('with analytics on', () => {
      beforeEach(() => {
        enableAnalytics()
      })

      test('shows the analytics cookies and the choice form', async () => {
        const res = await server.inject({ method: 'GET', url: '/cookies' })
        const $ = load(res.result)

        expect($('[data-testid="analytics-cookies"]')).toHaveLength(1)
        const form = $('[data-testid="cookies-form"]')
        expect(form.attr('action')).toBe('/cookies/consent')
        expect(form.find('input[name="returnUrl"]').val()).toBe('/cookies')
        expect(form.find('input[name="analytics"]:checked')).toHaveLength(0)
      })

      test('in Welsh, saving returns to the Welsh cookies page', async () => {
        const res = await server.inject({ method: 'GET', url: '/cy/cookies' })
        const $ = load(res.result)

        expect(
          $('[data-testid="cookies-form"] input[name="returnUrl"]').val()
        ).toBe('/cy/cookies')
        expect($('[data-testid="cookies-form"] legend').text()).toContain(
          '[Welsh]'
        )
      })

      test.each(['accepted', 'rejected'])(
        'pre-selects the saved choice (%s)',
        async (choice) => {
          const res = await server.inject({
            method: 'GET',
            url: '/cookies',
            headers: { cookie: consentCookie(choice) }
          })
          const $ = load(res.result)

          expect($('input[name="analytics"]:checked').val()).toBe(choice)
        }
      )

      test.each([
        [
          'an answer to an earlier policy version',
          consentCookie('accepted', { version: 0 })
        ],
        ['a bare string', 'analyticsConsent=accepted']
      ])('pre-selects nothing for %s', async (_label, cookie) => {
        const res = await server.inject({
          method: 'GET',
          url: '/cookies',
          headers: { cookie }
        })
        const $ = load(res.result)

        expect(res.statusCode).toBe(statusCodes.ok)
        expect($('input[name="analytics"]:checked')).toHaveLength(0)
      })

      test('does not show the cookie banner on the cookies page itself', async () => {
        const res = await server.inject({ method: 'GET', url: '/cookies' })
        const $ = load(res.result)

        expect($('[data-testid="cookie-banner"]')).toHaveLength(0)
      })
    })
  })

  describe('POST /cookies/consent', () => {
    test.each(['accepted', 'rejected'])(
      'saves %s and returns the visitor to where they answered',
      async (choice) => {
        const res = await postConsent(server, {
          analytics: choice,
          returnUrl: '/cy/contact?from=banner'
        })

        expect(res.statusCode).toBe(statusCodes.redirect)
        expect(res.headers.location).toBe('/cy/contact?from=banner')

        const cookie = setCookieFor(res, 'analyticsConsent')
        expect(decodeConsentSetCookie(cookie)).toEqual({
          analytics: choice,
          version: ANALYTICS_CONSENT_VERSION,
          decidedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
        })
        expect(cookie).toContain('Max-Age=31536000')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('SameSite=Lax')
        expect(cookie).toContain('Path=/')
      }
    )

    test.each(['', 'yes', 'ACCEPTED'])(
      'rejects an unrecognised choice (%j)',
      async (analytics) => {
        const res = await postConsent(server, { analytics, returnUrl: '/' })

        expect(res.statusCode).toBe(statusCodes.badRequest)
        expect(setCookieFor(res, 'analyticsConsent')).toBeUndefined()
      }
    )

    test('rejects a missing choice', async () => {
      const res = await postConsent(server, { returnUrl: '/' })
      expect(res.statusCode).toBe(statusCodes.badRequest)
    })

    test.each([
      'https://evil.example/phish',
      '//evil.example/phish',
      '/\\evil.example/phish',
      'contact',
      ''
    ])('never redirects off-site (returnUrl %j)', async (returnUrl) => {
      const res = await postConsent(server, {
        analytics: 'accepted',
        returnUrl
      })

      expect(res.statusCode).toBe(statusCodes.redirect)
      expect(res.headers.location).toBe('/')
    })

    test('falls back to / when no returnUrl is sent', async () => {
      const res = await postConsent(server, { analytics: 'accepted' })
      expect(res.headers.location).toBe('/')
    })

    test('withdrawing consent expires the analytics cookies the browser sent', async () => {
      const res = await postConsent(
        server,
        { analytics: 'rejected', returnUrl: '/cookies' },
        { headers: { cookie: '_ga=GA1.1.123; _ga_ABC123=GS1.1.456; other=x' } }
      )

      expect(setCookieFor(res, '_ga')).toMatch(/^_ga=;.*Max-Age=0/)
      expect(setCookieFor(res, '_ga_ABC123')).toMatch(
        /^_ga_ABC123=;.*Max-Age=0/
      )
      expect(setCookieFor(res, 'other')).toBeUndefined()
    })

    test('accepting leaves analytics cookies alone', async () => {
      const res = await postConsent(
        server,
        { analytics: 'accepted', returnUrl: '/cookies' },
        { headers: { cookie: '_ga=GA1.1.123' } }
      )

      expect(setCookieFor(res, '_ga')).toBeUndefined()
    })

    test('works for a signed-in operator', async () => {
      const res = await postConsent(server, {
        analytics: 'rejected',
        returnUrl: '/cookies'
      })

      expect(res.statusCode).toBe(statusCodes.redirect)
      expect(setCookieFor(res, 'analyticsConsent')).toBeDefined()
    })

    test('a save from the cookies page shows a success message there, once', async () => {
      enableAnalytics()
      const saved = await postConsent(server, {
        analytics: 'accepted',
        returnUrl: '/cookies'
      })
      const cookie = cookieHeaderFrom(saved)

      const first = await server.inject({
        method: 'GET',
        url: '/cookies',
        headers: { cookie }
      })
      const second = await server.inject({
        method: 'GET',
        url: '/cookies',
        headers: { cookie: `${cookie}; ${cookieHeaderFrom(first)}` }
      })

      expect(load(first.result)('[data-testid="cookies-saved"]')).toHaveLength(
        1
      )
      expect(load(second.result)('[data-testid="cookies-saved"]')).toHaveLength(
        0
      )
    })
  })
})

describe('cookies routes signed out, under the production auth scheme', () => {
  let server

  beforeAll(async () => {
    server = hapi.server()
    await server.register([
      { plugin: Yar, options: { cookieOptions: { password: 'x'.repeat(32) } } },
      authPlugin,
      nunjucksConfig,
      cookies
    ])
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each(['/cookies', '/cy/cookies'])(
    'GET %s renders rather than redirecting to sign in',
    async (url) => {
      const res = await server.inject({ method: 'GET', url })
      const $ = load(res.result)

      expect(res.statusCode).toBe(statusCodes.ok)
      expect($('[data-testid="nav-sign-out-link"]')).toHaveLength(0)
    }
  )

  test('POST /cookies/consent saves the choice rather than redirecting to sign in', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/cookies/consent',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'analytics=rejected&returnUrl=%2Fcookies'
    })

    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(res.headers.location).toBe('/cookies')
    expect(
      decodeConsentSetCookie(setCookieFor(res, 'analyticsConsent'))
    ).toEqual(expect.objectContaining({ analytics: 'rejected' }))
  })
})

describe('safeReturnUrl', () => {
  test.each([
    ['/contact', '/contact'],
    ['/cy/contact?a=1', '/cy/contact?a=1'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    [undefined, '/'],
    [42, '/']
  ])('%j → %j', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected)
  })
})
