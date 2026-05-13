import { describe, test, expect, vi, beforeEach } from 'vitest'
import { config } from '../../../../config/config.js'

describe('#initUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  test('calls CDP uploader /initiate and returns parsed JSON on success', async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'fileUpload.cdpUploaderUrl') return 'http://uploader'
      return originalGet(key)
    })

    const mockResponse = {
      uploadUrl: 'http://uploader/upload/abc',
      uploadId: 'abc',
      statusUrl: 'http://uploader/status/abc'
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    })

    const { initUpload } = await import('./init-upload.js')
    const result = await initUpload({
      redirect: '/file-upload/upload-status',
      s3Bucket: 'test-bucket',
      s3Path: 'file-uploads/Steel/2025',
      maxFileSize: 1024 * 1024 * 100,
      mimeTypes: ['application/pdf']
    })

    expect(result).toEqual(mockResponse)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://uploader/initiate',
      expect.objectContaining({ method: 'POST' })
    )
  })

  test('throws when CDP uploader returns non-OK response', async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'fileUpload.cdpUploaderUrl') return 'http://uploader'
      return originalGet(key)
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    const { initUpload } = await import('./init-upload.js')
    await expect(
      initUpload({ redirect: '/test', s3Bucket: 'bucket', s3Path: 'path' })
    ).rejects.toThrow('CDP uploader initiate failed')
  })
})
