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

const APPLICATION_ID = 'app-scd-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-contact-details`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-location`
const NEXT_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

const VALID_PAYLOAD =
  'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=+441234567890'

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) return ''
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addOverseasSiteSiteContactDetailsController', () => {
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

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
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
        'Who is the contact at the overseas reprocessing site?'
      )
    })

    test('renders name, email and phone inputs', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="contact-name-input"')
      expect(result).toContain('data-testid="contact-email-input"')
      expect(result).toContain('data-testid="contact-phone-input"')
    })

    test('back link points to site-location', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
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

    test('pre-populates fields from session when returning via Back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: VALID_PAYLOAD
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('Jane Smith')
      expect(result).toContain('jane@example.com')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Who is the contact at the overseas reprocessing site?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to recycling-operation-details when all required fields are valid', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: VALID_PAYLOAD
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('accepts empty phone number (optional)', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone='
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('returns 400 when contact name is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=&siteContactEmail=jane%40example.com&siteContactPhone='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter the contact name')
    })

    test('returns 400 when email is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=Jane+Smith&siteContactEmail=&siteContactPhone='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the email address')
    })

    test('returns 400 when email format is invalid', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=Jane+Smith&siteContactEmail=not-an-email&siteContactPhone='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter an email address in the correct format')
    })
  })
})
