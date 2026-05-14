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

describe('#fileUploadListController', () => {
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

  describe('GET /file-upload', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/file-upload',
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders upload new button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result } = await server.inject({
        method: 'GET',
        url: '/file-upload',
        headers: authHeaders
      })

      expect(result).toContain('data-testid="upload-new-button"')
    })

    test('shows no-files message when list is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result } = await server.inject({
        method: 'GET',
        url: '/file-upload',
        headers: authHeaders
      })

      expect(result).toContain('data-testid="no-files-message"')
    })

    test('renders file table when files are returned', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([
        {
          fileUploadId: 'abc123',
          filename: 'test.pdf',
          material: 'Steel',
          yearOfAccreditation: 2025,
          uploadedAt: '2025-01-01T00:00:00Z',
          scanStatus: 'Clean'
        }
      ])

      const { result } = await server.inject({
        method: 'GET',
        url: '/file-upload',
        headers: authHeaders
      })

      expect(result).toContain('data-testid="files-table"')
      expect(result).toContain('data-testid="view-file-link"')
    })

    test('renders error summary when API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/file-upload',
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="fetch-error"')
    })

    test('returns 200 for Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/cy/file-upload',
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
