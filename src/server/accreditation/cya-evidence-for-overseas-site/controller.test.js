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

const APPLICATION_ID = 'app-cya-bes-001'
const SITE_ID = '900001'

function makeApplication(overrides = {}) {
  return {
    ApplicationId: APPLICATION_ID,
    OrganisationId: 'test-operator-id',
    MaterialType: 'Plastic',
    Year: 2027,
    IsExporter: true,
    OverseasSites: {
      SectionStatus: 'InProgress',
      Sites: [
        {
          SiteId: 900001,
          SiteName: 'Site Alpha',
          Country: 'Germany',
          BESEvidence: {
            BESEvidenceUploads: [
              {
                FileId: 'file-bes-001',
                Filename: 'evidence.pdf',
                BESEvidenceValidFromDate: '2026-01-01T00:00:00Z',
                BESEvidenceExpiryDate: '2027-01-01T00:00:00Z'
              }
            ]
          }
        }
      ]
    },
    BesEvidence: { SectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#cyaEvidenceForSiteController', () => {
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

  describe('GET /accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}', () => {
    test('returns 200 with page heading including site name', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Check your BES evidence for')
      expect(result).toContain('Site Alpha')
    })

    test('renders uploaded evidence in summary list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="evidence-list"')
      expect(result).toContain('evidence.pdf')
      expect(result).toContain('data-testid="evidence-row-file-bes-001"')
    })

    test('handles uploads with null dates and missing fields gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          OverseasSites: {
            SectionStatus: 'InProgress',
            Sites: [
              {
                SiteId: 900001,
                SiteName: 'Site Alpha',
                Country: 'Germany',
                BESEvidence: {
                  BESEvidenceUploads: [
                    {
                      FileId: null,
                      Filename: null,
                      BESEvidenceValidFromDate: null,
                      BESEvidenceExpiryDate: null
                    }
                  ]
                }
              }
            ]
          }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="evidence-list"')
    })

    test('handles site not found gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/999999`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-files-message"')
    })

    test('shows no-files message when site has no uploads', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          OverseasSites: {
            SectionStatus: 'InProgress',
            Sites: [
              {
                SiteId: 900001,
                SiteName: 'Site Alpha',
                Country: 'Germany',
                BESEvidence: { BESEvidenceUploads: [] }
              }
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-files-message"')
    })

    test('handles null BESEvidenceUploads gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          OverseasSites: {
            SectionStatus: 'InProgress',
            Sites: [
              {
                SiteId: 900001,
                SiteName: 'Site Alpha',
                Country: 'Germany',
                BESEvidence: { BESEvidenceUploads: null }
              }
            ]
          }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-files-message"')
    })

    test('renders confirm button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="confirm-button"')
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Check your BES evidence for')
    })
  })

  describe('POST /accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}', () => {
    test('confirm redirects to upload-evidence-for-overseas-site list', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`
      )
    })
  })
})
