import { describe, test, expect, vi } from 'vitest'
import { provideUploadStatusFromSession } from './provide-upload-status.js'
import { apiClient } from '../../api-client.js'

function makeRequest(session) {
  return {
    yar: {
      get: vi.fn().mockReturnValue(session)
    }
  }
}

describe('#provideUploadStatusFromSession', () => {
  test('throws a 400 when there is no session entry for the key', async () => {
    const { method } = provideUploadStatusFromSession('uploadSession')
    const request = makeRequest(undefined)

    await expect(method(request)).rejects.toThrow(
      'No status URL found in session'
    )
  })

  test('throws a 400 when the session entry has no statusUrl', async () => {
    const { method } = provideUploadStatusFromSession('uploadSession')
    const request = makeRequest({})

    await expect(method(request)).rejects.toThrow(
      'No status URL found in session'
    )
  })

  test('fetches the status path extracted from the stored statusUrl', async () => {
    const { method } = provideUploadStatusFromSession('uploadSession')
    const request = makeRequest({
      statusUrl: 'http://localhost:3000/api/v1/files/abc123/status'
    })
    vi.spyOn(apiClient, 'get').mockResolvedValue({ uploadStatus: 'ready' })

    const result = await method(request)

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/files/abc123/status')
    expect(result).toEqual({ uploadStatus: 'ready' })
  })

  test('wraps a non-Boom failure as a 502', async () => {
    const { method } = provideUploadStatusFromSession('uploadSession')
    const request = makeRequest({
      statusUrl: 'http://localhost:3000/api/v1/files/abc123/status'
    })
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network down'))

    await expect(method(request)).rejects.toThrow(
      'CDP uploader status check failed'
    )
  })

  test('rethrows an existing Boom error unchanged', async () => {
    const Boom = (await import('@hapi/boom')).default
    const { method } = provideUploadStatusFromSession('uploadSession')
    const request = makeRequest({
      statusUrl: 'http://localhost:3000/api/v1/files/abc123/status'
    })
    const boomErr = Boom.notFound('missing upstream')
    vi.spyOn(apiClient, 'get').mockRejectedValue(boomErr)

    await expect(method(request)).rejects.toBe(boomErr)
  })
})
