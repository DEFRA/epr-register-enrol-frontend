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
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'NotStarted',
      sites: [
        {
          siteId: 900001,
          siteName: 'Site Alpha',
          siteAddress: '123 Test St',
          country: 'Germany',
          isEu: true,
          isOecd: true
        },
        {
          siteId: 900002,
          siteName: 'Site Beta',
          siteAddress: '456 Test Ave',
          country: 'Chad',
          isEu: false,
          isOecd: false
        }
      ]
    },
    ...overrides
  }
}

describe('#selectOverseasSitesController', () => {
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
      expect(result).toContain('Select the overseas reprocessing sites')
    })

    test('renders checkboxes for each site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="site-checkbox-900001"')
      expect(result).toContain('data-testid="site-checkbox-900002"')
      expect(result).toContain('Site Alpha')
      expect(result).toContain('Germany')
      expect(result).toContain('Site Beta')
      expect(result).toContain('Chad')
    })

    test('pre-checks sites where selected is undefined (default checked)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="site-checkbox-900001"')
      const checkbox1 = result.match(
        /data-testid="site-checkbox-900001"[^>]*>/
      )?.[0]
      expect(checkbox1).toContain('checked')
    })

    test('does not pre-check site where selected is false', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                selected: false
              },
              {
                siteId: 900002,
                siteName: 'Site Beta',
                country: 'Chad',
                selected: true
              }
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      const checkbox1 = result.match(
        /data-testid="site-checkbox-900001"[^>]*>/
      )?.[0]
      const checkbox2 = result.match(
        /data-testid="site-checkbox-900002"[^>]*>/
      )?.[0]
      expect(checkbox1).not.toContain('checked')
      expect(checkbox2).toContain('checked')
    })

    test('shows no-sites message when overseasSites.sites is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-sites-message"')
      expect(result).not.toContain('data-testid="select-sites-form"')
    })

    test('handles null overseasSites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ overseasSites: null })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('continue button is present inside the form', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain('data-testid="select-sites-form"')
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
      expect(result).toContain('[Welsh] Select the overseas reprocessing sites')
    })
  })

  describe('POST /accreditation/select-overseas-sites/{applicationId}', () => {
    test('redirects to confirm-overseas-sites when sites are selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { siteIds: ['900001'] }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('patches overseas sites with selected flags', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { siteIds: ['900001'] }
      })

      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining('overseas-sites'),
        expect.objectContaining({
          sites: expect.arrayContaining([
            expect.objectContaining({ siteId: 900001, selected: true }),
            expect.objectContaining({ siteId: 900002, selected: false })
          ])
        })
      )
    })

    test('accepts multiple selected sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { siteIds: ['900001', '900002'] }
      })

      expect(patchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sites: expect.arrayContaining([
            expect.objectContaining({ siteId: 900001, selected: true }),
            expect.objectContaining({ siteId: 900002, selected: true })
          ])
        })
      )
    })

    test('returns 400 with error when no sites selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select at least one overseas reprocessing site')
    })

    test('returns 400 and shows sites unchecked when validation fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(result).toContain('data-testid="site-checkbox-900001"')
      const checkbox = result.match(
        /data-testid="site-checkbox-900001"[^>]*>/
      )?.[0]
      expect(checkbox).not.toContain('checked')
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { siteIds: ['900001'] }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 500 service-problem page when PATCH fails with server error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('Patch failed'), { status: 500 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { siteIds: ['900001'] }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="try-again-link"')
    })
  })
})
