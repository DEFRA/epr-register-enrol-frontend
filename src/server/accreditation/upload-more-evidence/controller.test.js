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

const APPLICATION_ID = 'app-ume-001'
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
          besEvidence: { besEvidenceUploads: [] }
        }
      ]
    },
    besEvidence: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#uploadMoreEvidenceController', () => {
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

  describe('GET /accreditation/upload-more-evidence/{applicationId}/{siteId}', () => {
    test('returns 200 with page heading including site name', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Do you want to upload more evidence')
      expect(result).toContain('Site Alpha')
    })

    test('renders yes and no radio buttons', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="answer-yes"')
      expect(result).toContain('data-testid="answer-no"')
    })

    test('handles site not found gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/999999`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Do you want to upload more evidence')
    })
  })

  describe('POST /accreditation/upload-more-evidence/{applicationId}/{siteId}', () => {
    test('returns 500 when GET application fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { answer: 'yes' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('handles site not found gracefully on POST', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/999999`,
        headers: operatorHeaders,
        payload: { answer: 'yes' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('returns 400 when no answer selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select yes if you want to upload more evidence')
    })

    test('yes answer redirects to upload-bes-evidence', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { answer: 'yes' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`
      )
    })

    test('no answer patches DoYouWantToUploadMoreEvidence and redirects to cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { answer: 'no' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/cya-evidence-for-overseas-site/${APPLICATION_ID}/${SITE_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${APPLICATION_ID}/overseas-sites/900001/bes-evidence`
        ),
        { doYouWantToUploadMoreEvidence: false }
      )
    })

    test('no answer returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { answer: 'no' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
