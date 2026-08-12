import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { config } from '../../../../config/config.js'

const APPLICATION_ID = 'app-is-country-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/country`
const SITE_NAME_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

describe('#addInterimSiteCountryController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const operatorHeaders = {
    'x-test-user-type': 'operator'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('What country is the interim site in?')
    })

    test('renders country input', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="country-input"')
    })

    test('renders country as a GDS select populated with the country list, not a text box', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toMatch(
        /<select[^>]*id="country"[^>]*data-testid="country-input"/
      )
      expect(result).not.toContain('type="text"\n                 id="country"')
      expect(result).toContain('>France</option>')
      expect(result).toContain('>Germany</option>')
    })

    test('back link points to select-overseas-sites', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    test('pre-populates input with value from session when returning via Back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=France'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = postResponse.headers['set-cookie']

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          cookie: Array.isArray(sessionCookie)
            ? sessionCookie.map((c) => c.split(';')[0]).join('; ')
            : (sessionCookie?.split(';')[0] ?? '')
        }
      })

      expect(getResponse.statusCode).toBe(statusCodes.ok)
      expect(getResponse.result).toContain('France')
    })

    test('marks the session country as the selected option when returning via Back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=France'
      })
      const sessionCookie = postResponse.headers['set-cookie']

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          cookie: Array.isArray(sessionCookie)
            ? sessionCookie.map((c) => c.split(';')[0]).join('; ')
            : (sessionCookie?.split(';')[0] ?? '')
        }
      })

      expect(getResponse.result).toContain('value="France" selected')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] What country is the interim site in?')
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to site-name when country is valid', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=Germany'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SITE_NAME_URL)
    })

    test('saves country to session on valid POST', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=Spain'
      })
      const sessionCookie = postResponse.headers['set-cookie']

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          cookie: Array.isArray(sessionCookie)
            ? sessionCookie.map((c) => c.split(';')[0]).join('; ')
            : (sessionCookie?.split(';')[0] ?? '')
        }
      })

      expect(getResponse.result).toContain('Spain')
    })

    test('returns 400 with inline error when country is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter the country')
    })

    test('links the select to the error message via aria-describedby', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country='
      })

      expect(result).toContain('aria-describedby="country-error"')
    })

    test('returns 400 with inline error when country payload is absent entirely', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the country')
    })

    test('returns 400 with error when country is whitespace only', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=   '
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the country')
    })

    test('cancel link clears session and redirects to select-overseas-sites', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=Italy'
      })
      const sessionCookie = postResponse.headers['set-cookie']
      const cookieHeader = Array.isArray(sessionCookie)
        ? sessionCookie.map((c) => c.split(';')[0]).join('; ')
        : (sessionCookie?.split(';')[0] ?? '')

      const cancelUrl = `/accreditation/add-interim-site/${APPLICATION_ID}/cancel`
      const cancelResponse = await server.inject({
        method: 'GET',
        url: cancelUrl,
        headers: { ...operatorHeaders, cookie: cookieHeader }
      })

      expect(cancelResponse.statusCode).toBe(statusCodes.redirect)
      expect(cancelResponse.headers.location).toBe(SELECT_ORS_URL)
    })
  })
})
