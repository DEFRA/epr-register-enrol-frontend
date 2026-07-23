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
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'

const APPLICATION_ID = 'app-cya-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function makeApplication(sites = []) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'org-001',
    overseasSites: { sectionStatus: 'InProgress', sites }
  }
}

describe('#addOrsCyaController', () => {
  let server
  let cookie

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

  beforeEach(async () => {
    vi.clearAllMocks()

    const res = await server.inject({
      method: 'GET',
      url: BASE_URL,
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        'x-test-user-type': 'operator'
      }
    })
    const setCookie = res.headers['set-cookie']
    cookie = Array.isArray(setCookie)
      ? setCookie[0].split(';')[0]
      : (setCookie ?? '').split(';')[0]
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with check your answers heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Check your answers')
    })

    test('renders summary list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="summary-list"')
    })

    test('renders site name row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-site-name"')
      expect(result).toContain('Site name')
    })

    test('renders contact name row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-contact-name"')
    })

    test('renders repatriated loads row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-repatriated-loads"')
    })

    test('renders change links', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="change-site-name"')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Check your answers')
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to select-overseas-sites on success', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([{ siteId: 1, orsId: '001' }])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('renders error when API call fails', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockRejectedValue(
        new Error('API error')
      )

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

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
