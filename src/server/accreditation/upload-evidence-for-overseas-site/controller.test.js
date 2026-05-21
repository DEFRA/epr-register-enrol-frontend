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

const APPLICATION_ID = 'app-uel-001'

const SITE_WITH_EVIDENCE = {
  siteId: 900001,
  siteName: 'Site Alpha',
  siteAddress: '123 Test St',
  country: 'Germany',
  isEu: true,
  isOecd: true,
  besEvidence: {
    besEvidenceUploads: [
      {
        fileId: 'file001',
        filename: 'evidence.pdf',
        besEvidenceValidFromDate: '2026-01-01T00:00:00Z',
        besEvidenceExpiryDate: '2027-01-01T00:00:00Z'
      }
    ]
  }
}

const SITE_WITHOUT_EVIDENCE = {
  siteId: 900002,
  siteName: 'Site Beta',
  siteAddress: '456 Test Ave',
  country: 'Chad',
  isEu: false,
  isOecd: false,
  besEvidence: { besEvidenceUploads: [] }
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'InProgress',
      sites: [SITE_WITH_EVIDENCE, SITE_WITHOUT_EVIDENCE]
    },
    besEvidence: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#uploadEvidenceListController', () => {
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

  describe('GET /accreditation/upload-evidence-for-overseas-site/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain(
        'Upload evidence of broadly equivalent standards'
      )
    })

    test('renders sites table with both sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="sites-table"')
      expect(result).toContain('Site Alpha')
      expect(result).toContain('Site Beta')
    })

    test('shows uploaded evidence status for site with evidence', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="evidence-status-900001"')
      expect(result).toContain('Uploaded')
    })

    test('shows not-uploaded evidence status for site without evidence', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="evidence-status-900002"')
      expect(result).toContain('Not uploaded')
    })

    test('renders upload links for each site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="upload-link-900001"')
      expect(result).toContain('data-testid="upload-link-900002"')
      expect(result).toContain(
        `/accreditation/upload-bes-evidence/${APPLICATION_ID}/900001`
      )
    })

    test('shows no-sites message when overseasSites.sites is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-sites-message"')
      expect(result).not.toContain('data-testid="sites-table"')
    })

    test('handles sites with null optional fields gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [{ siteId: 900003 }]
          }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="sites-table"')
      expect(result).toContain('data-testid="evidence-status-900003"')
      expect(result).toContain('Not uploaded')
    })

    test('handles null overseasSites.sites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: null }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('back link points to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(`/accreditation/task-list/${APPLICATION_ID}`)
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Upload evidence of broadly equivalent standards'
      )
    })
  })

  describe('POST /accreditation/upload-evidence-for-overseas-site/{applicationId}', () => {
    test('returns 500 when GET application fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('patches BES evidence section as Completed and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/bes-evidence`),
        { sectionStatus: 'Completed' }
      )
    })

    test('returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-evidence-for-overseas-site/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
