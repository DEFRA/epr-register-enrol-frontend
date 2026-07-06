import { describe, test, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../../api-client.js'

vi.mock('../../api-client.js', () => ({
  apiClient: { post: vi.fn() }
}))

describe('#initUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('calls apiClient.post with initiateUrl and body fields', async () => {
    const mockResponse = {
      fileUploadId: 'abc-123',
      uploadUrl: 'http://backend/upload/abc-123',
      statusUrl: 'http://backend/status/abc-123'
    }
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

    const { initUpload } = await import('./init-upload.js')
    const result = await initUpload({
      initiateUrl:
        '/api/v1/accreditation-applications/org1/app1/files/initiate',
      redirectUrl: '/accreditation/sampling-plan/app1/status',
      s3Path: 'accreditation/sampling-plan/app1',
      s3Bucket: 'test-bucket',
      maxFileSize: 1024 * 1024 * 20,
      mimeTypes: ['application/pdf']
    })

    expect(result).toEqual(mockResponse)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/accreditation-applications/org1/app1/files/initiate',
      {
        redirectUrl: '/accreditation/sampling-plan/app1/status',
        s3Path: 'accreditation/sampling-plan/app1',
        s3Bucket: 'test-bucket',
        maxFileSize: 1024 * 1024 * 20,
        mimeTypes: ['application/pdf'],
        metadata: undefined
      }
    )
  })

  test('passes metadata when provided', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})

    const { initUpload } = await import('./init-upload.js')
    await initUpload({
      initiateUrl: '/api/v1/file-uploads/initiate',
      metadata: { siteId: '900001' }
    })

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/file-uploads/initiate',
      expect.objectContaining({ metadata: { siteId: '900001' } })
    )
  })

  test('throws when initiateUrl is missing', async () => {
    const { initUpload } = await import('./init-upload.js')
    await expect(initUpload({})).rejects.toThrow(
      'initUpload: initiateUrl is required'
    )
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('propagates errors from apiClient.post', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new Error('Backend unavailable')
    )

    const { initUpload } = await import('./init-upload.js')
    await expect(
      initUpload({ initiateUrl: '/api/v1/file-uploads/initiate' })
    ).rejects.toThrow('Backend unavailable')
  })
})
