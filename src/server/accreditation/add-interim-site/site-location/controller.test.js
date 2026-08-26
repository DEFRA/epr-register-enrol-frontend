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

const APPLICATION_ID = 'app-is-loc-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`
const BACK_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`
const NEXT_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-contact-details`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

const VALID_PAYLOAD =
  'addressLine1=Unit+1&addressLine2=Industrial+Park&townOrCity=Rotterdam&stateOrRegion=Zuid-Holland&postcode=3011+AA'

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) {
    return ''
  }
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addInterimSiteLocationController', () => {
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

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Where is the interim site located?')
    })

    test('renders address and location inputs', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="address-line1-input"')
      expect(result).toContain('data-testid="address-line2-input"')
      expect(result).toContain('data-testid="town-or-city-input"')
      expect(result).toContain('data-testid="state-or-region-input"')
      expect(result).toContain('data-testid="postcode-input"')
    })

    test('does not render a country or coordinates input', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="country-input"')
      expect(result).not.toContain('data-testid="coordinates-input"')
    })

    test('back link points to site-name', async () => {
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

    // RA-481: this wizard holds its draft in session, not on the
    // application, so once overseasSites is locked there's nothing
    // meaningful to render read-only — send the operator back to the
    // section's list page instead.
    test('redirects to select-overseas-sites when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
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

      expect(result).toContain('Rotterdam')
      expect(result).toContain('Zuid-Holland')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Where is the interim site located?')
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to site-contact-details when required fields are valid', async () => {
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

    test('accepts empty optional fields', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'addressLine1=Unit+1&townOrCity=Rotterdam'
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('returns 400 when address line 1 is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'addressLine1=&townOrCity=Rotterdam'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter address line 1')
    })

    test('returns 400 when town or city is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'addressLine1=Unit+1&townOrCity='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the town or city')
    })
  })
})
