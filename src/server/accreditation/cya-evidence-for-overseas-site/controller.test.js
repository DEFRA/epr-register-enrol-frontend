import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'

const APPLICATION_ID = 'app-cya-bes-001'
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
          country: 'Germany',
          besEvidence: {
            besEvidenceUploads: [
              {
                fileId: 'file-bes-001',
                filename: 'evidence.pdf',
                besEvidenceValidFromDate: '2026-01-01T00:00:00Z',
                besEvidenceExpiryDate: '2027-01-01T00:00:00Z'
              }
            ]
          }
        }
      ]
    },
    besEvidence: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#cyaEvidenceForSiteController', () => {
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

  describe('GET /accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}', () => {
    test('redirects to query-task-list when application is Queried and BES evidence section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          besEvidence: { sectionStatus: 'NotStarted' }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

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
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                besEvidence: {
                  besEvidenceUploads: [
                    {
                      fileId: null,
                      filename: null,
                      besEvidenceValidFromDate: null,
                      besEvidenceExpiryDate: null
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
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                besEvidence: { besEvidenceUploads: [] }
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
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                besEvidence: { besEvidenceUploads: null }
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

    test('renders amend link and delete button for each file when not read-only', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="amend-file-file-bes-001"')
      expect(result).toContain(
        `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}/amend/file-bes-001`
      )
      expect(result).toContain('data-testid="delete-file-button-file-bes-001"')
    })

    test('does not render amend link or delete button when read-only', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          besEvidence: { sectionStatus: 'Completed' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="amend-file-file-bes-001"')
      expect(result).not.toContain(
        'data-testid="delete-file-button-file-bes-001"'
      )
    })

    test('renders a link to add another file when not read-only', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-file-link"')
      expect(result).toContain(
        `href="/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}"`
      )
    })

    test('does not render the add-file link when read-only', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          besEvidence: { sectionStatus: 'Completed' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="add-file-link"')
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

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders read-only (200, not a redirect), without the confirm button, when application is locked (%s) and BES evidence section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            besEvidence: { sectionStatus: 'Completed' }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
        expect(result).not.toContain('data-testid="confirm-button"')
      }
    )
  })

  describe('POST /accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}', () => {
    test('confirm redirects to upload-evidence-for-overseas-site list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

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

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page without confirming when application is locked (%s) and BES evidence section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            besEvidence: { sectionStatus: 'Completed' }
          })
        )

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
          headers: operatorHeaders,
          payload: {}
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`
        )
      }
    )

    describe('action=deleteFile', () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      function makeApplicationWithFiles(fileIds) {
        return makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                besEvidence: {
                  besEvidenceUploads: fileIds.map((fileId) => ({
                    fileId,
                    filename: `${fileId}.pdf`,
                    besEvidenceValidFromDate: '2026-01-01T00:00:00Z',
                    besEvidenceExpiryDate: null
                  }))
                }
              }
            ]
          }
        })
      }

      test('deletes the file and redirects back to this page when more than one file remains', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplicationWithFiles(['file-1', 'file-2'])
        )
        const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
          headers: operatorHeaders,
          payload: { action: 'deleteFile', fileId: 'file-1' }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`
        )
        expect(deleteSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `/overseas-sites/${SITE_ID}/bes-evidence/files/file-1`
          )
        )
      })

      test('blocks deleting the only remaining file', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplicationWithFiles(['file-1'])
        )
        const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

        const { result, statusCode } = await server.inject({
          method: 'POST',
          url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
          headers: operatorHeaders,
          payload: { action: 'deleteFile', fileId: 'file-1' }
        })

        expect(statusCode).toBe(statusCodes.badRequest)
        expect(result).toContain('data-testid="error-summary"')
        expect(result).toContain('At least one BES evidence file is required')
        expect(deleteSpy).not.toHaveBeenCalled()
      })

      test('returns 500 when delete API fails on every retry', async () => {
        vi.useFakeTimers()
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplicationWithFiles(['file-1', 'file-2'])
        )
        vi.spyOn(apiClient, 'delete').mockRejectedValue(new Error('API down'))

        const injectPromise = server.inject({
          method: 'POST',
          url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
          headers: operatorHeaders,
          payload: { action: 'deleteFile', fileId: 'file-1' }
        })
        await vi.advanceTimersByTimeAsync(15000)
        const { result, statusCode } = await injectPromise

        expect(statusCode).toBe(statusCodes.internalServerError)
        expect(result).toContain('data-testid="error-summary"')
      })

      test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
        'redirects back to this page without deleting when application is locked (%s) and BES evidence section is not Queried',
        async (applicationStatus) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue({
            ...makeApplicationWithFiles(['file-1', 'file-2']),
            applicationStatus,
            besEvidence: { sectionStatus: 'Completed' }
          })
          const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

          const { statusCode, headers } = await server.inject({
            method: 'POST',
            url: `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`,
            headers: operatorHeaders,
            payload: { action: 'deleteFile', fileId: 'file-1' }
          })

          expect(statusCode).toBe(statusCodes.redirect)
          expect(headers.location).toBe(
            `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`
          )
          expect(deleteSpy).not.toHaveBeenCalled()
        }
      )
    })
  })
})
