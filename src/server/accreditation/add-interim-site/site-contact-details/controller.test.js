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
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'

const APPLICATION_ID = 'app-is-scd-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-contact-details`
const BACK_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`
const NEXT_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/recycling-operation-details`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

const VALID_PAYLOAD =
  'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=%2B441234567890'

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) {
    return ''
  }
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addInterimSiteContactDetailsController', () => {
  let server

  beforeAll(async () => {
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

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  // RA-486: every GET on the interim wizard now guards on linkedSiteId, so
  // GET tests must first walk through the ORS "Save and add interim site"
  // entry point to seed a real linkedSiteId in session.
  async function seedLinkedSiteSession() {
    vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
      applicationId: APPLICATION_ID,
      organisationId: 'org-001',
      overseasSites: { sectionStatus: 'InProgress', sites: [] }
    })
    vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue({
      siteId: 555
    })

    const cyaResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`,
      headers: postHeaders,
      payload: 'action=addInterimSite'
    })
    expect(cyaResponse.statusCode).toBe(statusCodes.redirect)

    return cookiesFrom(cyaResponse)
  }

  describe(`GET ${BASE_URL}`, () => {
    test('redirects to select-overseas-sites when there is no linked ORS site (direct navigation)', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('returns 200 with page heading', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Who is the contact at the interim site?')
    })

    test('renders name, email and phone inputs', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="contact-name-input"')
      expect(result).toContain('data-testid="contact-email-input"')
      expect(result).toContain('data-testid="contact-phone-input"')
    })

    test('back link points to site-location', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    // RA-481: this wizard holds its draft in session, not on the
    // application, so once overseasSites is locked there's nothing
    // meaningful to render read-only — send the operator back to the
    // section's list page instead.
    test('redirects to select-overseas-sites when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      const cookie = await seedLinkedSiteSession()
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('pre-populates fields from session when returning via Back', async () => {
      const cookie = await seedLinkedSiteSession()
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: VALID_PAYLOAD
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = cookiesFrom(postResponse) || cookie

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('Jane Smith')
      expect(result).toContain('jane@example.com')
    })

    test('returns 200 in Welsh locale', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Who is the contact at the interim site?'
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

    test('redirects to select-overseas-sites without saving when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: VALID_PAYLOAD
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('returns 400 when contact name is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=&siteContactEmail=jane%40example.com&siteContactPhone=01234567890'
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
          'siteContactName=Jane+Smith&siteContactEmail=&siteContactPhone=01234567890'
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
          'siteContactName=Jane+Smith&siteContactEmail=not-an-email&siteContactPhone=01234567890'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter an email address in the correct format')
    })

    test('returns 400 when phone number is empty (required, unlike ORS)', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter the phone number')
    })
  })
})
