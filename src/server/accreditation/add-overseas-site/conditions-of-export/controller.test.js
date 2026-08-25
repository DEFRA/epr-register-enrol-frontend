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

const APPLICATION_ID = 'app-coe-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/conditions-of-export`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/repatriated-loads`
const CYA_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

describe('#addOrsConditionsOfExportController', () => {
  let server
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    vi.clearAllMocks()

    const res = await server.inject({
      method: 'GET',
      url: BASE_URL,
      headers: {
        'x-test-user-type': 'operator'
      }
    })
    const setCookie = res.headers['set-cookie']
    cookie = Array.isArray(setCookie)
      ? setCookie[0].split(';')[0]
      : (setCookie ?? '').split(';')[0]
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
      expect(result).toContain('Does the site meet the conditions of export?')
    })

    test('renders conditions list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="conditions-list"')
      expect(result).toContain(
        'The application is for export of Aluminium or Steel packaging waste.'
      )
    })

    test('renders Yes/No radios', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="radio-yes"')
      expect(result).toContain('data-testid="radio-no"')
    })

    test('back link points to repatriated-loads', async () => {
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

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Does the site meet the conditions of export?'
      )
    })
  })

  describe(`POST ${BASE_URL} (validation)`, () => {
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
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'conditionsOfExport=yes'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('returns 400 when no radio selected', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain(
        'Select yes if the site meets the conditions of export'
      )
    })

    test('redirects to check-your-answers when Yes selected', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'conditionsOfExport=yes'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(CYA_URL)
    })

    test('redirects to check-your-answers when No selected', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'conditionsOfExport=no'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(CYA_URL)
    })
  })
})
