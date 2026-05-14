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
import { realApiClient as apiClient } from '../../common/api-client.js'

const FILE_UPLOAD_ID = 'aabbccddeeff001122334455'

describe('#fileUploadDetailController', () => {
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

  const authHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  function makeFileUpload(overrides = {}) {
    return {
      fileUploadId: FILE_UPLOAD_ID,
      organisationId: 'org-123',
      material: 'Steel',
      yearOfAccreditation: 2025,
      fileId: 'cdp-upload-id',
      filename: 'report.pdf',
      contentType: 'application/pdf',
      s3Key: 'file-uploads/Steel/2025/report.pdf',
      scanStatus: 'Clean',
      uploadedAt: '2025-06-01T12:00:00Z',
      ...overrides
    }
  }

  describe('GET /file-upload/{fileUploadId}', () => {
    test('returns 200 with file details when file exists', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeFileUpload())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="file-details"')
    })

    test('shows download button when scan status is Clean', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeFileUpload({ scanStatus: 'Clean' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(result).toContain('data-testid="download-button"')
    })

    test('does not show download button when scan status is Pending', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeFileUpload({ scanStatus: 'Pending' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(result).not.toContain('data-testid="download-button"')
    })

    test('does not show download button when scan status is Infected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeFileUpload({ scanStatus: 'Infected' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(result).not.toContain('data-testid="download-button"')
    })

    test('returns 404 when file is not found', async () => {
      const notFoundError = new Error('Not found')
      notFoundError.status = 404
      vi.spyOn(apiClient, 'get').mockRejectedValue(notFoundError)

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(statusCode).toBe(404)
    })

    test('returns 500 with error summary when API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('renders back link to file list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeFileUpload())

      const { result } = await server.inject({
        method: 'GET',
        url: `/file-upload/${FILE_UPLOAD_ID}`,
        headers: authHeaders
      })

      expect(result).toContain('href="/file-upload"')
    })
  })
})
