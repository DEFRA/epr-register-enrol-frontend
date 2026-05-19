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

const APPLICATION_ID = 'app-sos-001'

function makeApplication(overrides = {}) {
  return {
    ApplicationId: APPLICATION_ID,
    OrganisationId: 'test-operator-id',
    MaterialType: 'Plastic',
    Year: 2027,
    IsExporter: true,
    OverseasSites: {
      SectionStatus: 'NotStarted',
      Sites: [
        {
          SiteId: 900001,
          SiteName: 'Site Alpha',
          SiteAddress: '123 Test St',
          Country: 'Germany',
          IsEu: true,
          IsOECD: true
        },
        {
          SiteId: 900002,
          SiteName: 'Site Beta',
          SiteAddress: '456 Test Ave',
          Country: 'Chad',
          IsEu: false,
          IsOECD: false
        }
      ]
    },
    ...overrides
  }
}

describe('#selectOverseasSitesGetController', () => {
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

  describe('GET /accreditation/select-overseas-sites/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Your overseas reprocessing sites')
    })

    test('renders sites table with both sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="sites-table"')
      expect(result).toContain('Site Alpha')
      expect(result).toContain('Germany')
      expect(result).toContain('Site Beta')
      expect(result).toContain('Chad')
    })

    test('shows no-sites message when OverseasSites.Sites is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          OverseasSites: { SectionStatus: 'NotStarted', Sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-sites-message"')
      expect(result).not.toContain('data-testid="sites-table"')
    })

    test('handles null OverseasSites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ OverseasSites: null })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('continue button links to confirm-overseas-sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('back link points to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(`/accreditation/task-list/${APPLICATION_ID}`)
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Your overseas reprocessing sites')
    })
  })
})
