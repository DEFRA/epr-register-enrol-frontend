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

const APPLICATION_ID = 'app-sn-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
const SITE_LOCATION_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-location`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

describe('#addOverseasSiteSiteNameController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
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
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
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
      expect(result).toContain(
        'What is the name of the overseas reprocessing site?'
      )
    })

    test('renders site name input', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="site-name-input"')
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
      // POST a valid site name to populate session, then GET to check pre-population
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=My+Test+Site'
      })
      // Should redirect (302) to site-location
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
      expect(getResponse.result).toContain('My Test Site')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What is the name of the overseas reprocessing site?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to site-location when site name is valid', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=Acme+Recyclers+GmbH'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SITE_LOCATION_URL)
    })

    test('saves site name to session on valid POST', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=Recyclers+Ltd'
      })
      const sessionCookie = postResponse.headers['set-cookie']

      // GET the same page with session cookie — should show pre-populated value
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

      expect(getResponse.result).toContain('Recyclers Ltd')
    })

    test('returns 400 with inline error when site name is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter the site name')
    })

    test('returns 400 with error when siteName is whitespace only', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=   '
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the site name')
    })

    test('cancel link clears session and redirects to select-overseas-sites', async () => {
      // POST a site name first to put something in session
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=Site+To+Cancel'
      })
      const sessionCookie = postResponse.headers['set-cookie']
      const cookieHeader = Array.isArray(sessionCookie)
        ? sessionCookie.map((c) => c.split(';')[0]).join('; ')
        : (sessionCookie?.split(';')[0] ?? '')

      const cancelUrl = `/accreditation/add-overseas-site/${APPLICATION_ID}/cancel`
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
