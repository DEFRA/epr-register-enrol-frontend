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

const APPLICATION_ID = 'app-cos-001'

const SITE_ONE = {
  siteId: 900001,
  siteName: 'Site Alpha',
  siteAddress: '123 Test St',
  country: 'Germany',
  isEu: true,
  isOecd: true
}

const SITE_TWO = {
  siteId: 900002,
  siteName: 'Site Beta',
  siteAddress: '456 Test Ave',
  country: 'Chad',
  isEu: false,
  isOecd: false
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'NotStarted',
      sites: [SITE_ONE, SITE_TWO]
    },
    ...overrides
  }
}

describe('#confirmOverseasSitesController', () => {
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

  describe('GET /accreditation/confirm-overseas-sites/{applicationId}', () => {
    test('returns 200 with page heading and sites list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Confirm your overseas reprocessing sites')
      expect(result).toContain('data-testid="sites-list"')
      expect(result).toContain('Site Alpha')
      expect(result).toContain('Germany')
    })

    test('renders remove button for each site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="remove-button-900001"')
      expect(result).toContain('data-testid="remove-button-900002"')
    })

    test('renders confirm button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="confirm-button"')
    })

    test('shows no-sites message when sites array is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('handles null overseasSites.sites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: null }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('back link points to select-overseas-sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Confirm your overseas reprocessing sites'
      )
    })
  })

  describe('POST /accreditation/confirm-overseas-sites/{applicationId}', () => {
    test('returns 500 when GET application fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('remove action handles null overseasSites.sites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: null }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'remove', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/overseas-sites`),
        expect.objectContaining({ sites: [] })
      )
      expect(headers.location).toContain(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('remove action patches with updated sites and redirects to GET', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'remove', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/overseas-sites`),
        expect.objectContaining({
          sites: expect.arrayContaining([
            expect.objectContaining({ siteId: 900001, selected: false }),
            expect.objectContaining({ siteId: 900002 })
          ])
        })
      )
    })

    test('remove action returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'remove', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('confirm action patches SectionStatus Completed and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/overseas-sites`),
        { sectionStatus: 'Completed' }
      )
    })

    test('confirm action returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
