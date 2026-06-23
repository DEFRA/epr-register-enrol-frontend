import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { apiClient } from '../../common/api-client.js'

const APPLICATION_ID = 'app-csc-001'
const SITE_ID = '900001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'InProgress',
      sites: [
        {
          siteId: 900001,
          siteName: 'Site Alpha',
          country: 'Germany'
        }
      ]
    },
    besEvidence: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#checkSiteConditionsController', () => {
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

  describe('GET /accreditation/check-site-conditions/{applicationId}/{siteId}', () => {
    test('returns 200 with page heading and site name', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Check the site fulfils the conditions')
      expect(result).toContain('data-testid="site-name"')
      expect(result).toContain('Site Alpha')
    })

    test('renders placeholder content and confirm button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="placeholder-content"')
      expect(result).toContain('data-testid="confirm-button"')
    })

    test('handles site not found gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/999999`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('back link points to cya-evidence-for-overseas-site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`
      )
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Check the site fulfils the conditions')
    })
  })

  describe('POST /accreditation/check-site-conditions/{applicationId}/{siteId}', () => {
    test('confirm redirects to task list', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/check-site-conditions/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
    })
  })
})
