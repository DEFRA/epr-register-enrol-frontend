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

const APPLICATION_ID = 'app-sl-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-location`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
const NEXT_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-contact-details`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

const VALID_PAYLOAD =
  'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=10115&country=Germany&coordinates=52.52%2C+13.40'

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) return ''
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addOverseasSiteSiteLocationController', () => {
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
        'Where is the overseas reprocessing site located?'
      )
    })

    test('renders all address input fields', async () => {
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
      expect(result).toContain('data-testid="country-input"')
      expect(result).toContain('data-testid="coordinates-input"')
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

      expect(result).toContain('123 Main St')
      expect(result).toContain('Berlin')
      expect(result).toContain('10115')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Where is the overseas reprocessing site located?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to site-contact-details when all required fields are valid', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: VALID_PAYLOAD
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('saves address fields to session on valid POST', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: VALID_PAYLOAD
      })

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(getResponse.result).toContain('123 Main St')
      expect(getResponse.result).toContain('Berlin')
      expect(getResponse.result).toContain('Germany')
    })

    test('returns 400 with error when addressLine1 is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter address line 1')
    })

    test('returns 400 with error when townOrCity is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=&stateOrRegion=&postcode=&country=Germany&coordinates='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the town or city')
    })

    test('returns 400 with error when country is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=&coordinates='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select a country')
    })

    test('returns 400 with error when coordinates is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the coordinates')
    })

    test('returns 400 when coordinates are malformed', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates=not-valid'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter coordinates in the correct format')
    })

    test('returns 400 when latitude is out of range', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates=91%2C+13.4'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Latitude must be between -90 and 90')
    })

    test('returns 400 when longitude is out of range', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+Main+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates=52.5%2C+181'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Longitude must be between -180 and 180')
    })

    test('accepts valid coordinates and redirects', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=1+St&addressLine2=&townOrCity=Berlin&stateOrRegion=&postcode=&country=Germany&coordinates=52.52%2C+13.40'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('accepts optional fields empty and redirects', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'addressLine1=123+St&addressLine2=&townOrCity=Paris&stateOrRegion=&postcode=&country=France&coordinates=48.85%2C+2.35'
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })
  })
})
