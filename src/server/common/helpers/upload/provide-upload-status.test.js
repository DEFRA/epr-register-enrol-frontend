import { describe, test, expect, vi } from 'vitest'
import { provideUploadStatusFromSession } from './provide-upload-status.js'
import { apiClient } from '../../api-client.js'

const STATUS_URL = 'http://localhost:3000/api/v1/files/abc123/status'
const uploadPageUrl = ({ applicationId }) => `/upload/${applicationId}`

function makeRequest(session, path = '/upload/app-1/status') {
  return {
    path,
    params: { applicationId: 'app-1' },
    yar: {
      get: vi.fn().mockReturnValue(session)
    }
  }
}

function makeToolkit() {
  const response = {
    code: vi.fn().mockReturnThis(),
    takeover: vi.fn().mockReturnThis()
  }
  return { response, h: { view: vi.fn().mockReturnValue(response) } }
}

function apiError(status) {
  return Object.assign(new Error(`API request failed: ${status}`), { status })
}

describe('#provideUploadStatusFromSession', () => {
  const { method } = provideUploadStatusFromSession(
    'uploadSession',
    uploadPageUrl
  )

  test('throws a 400 when there is no session entry for the key', async () => {
    await expect(method(makeRequest(undefined))).rejects.toThrow(
      'No status URL found in session'
    )
  })

  test('throws a 400 when the session entry has no statusUrl', async () => {
    await expect(method(makeRequest({}))).rejects.toThrow(
      'No status URL found in session'
    )
  })

  test('fetches the status path extracted from the stored statusUrl', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ uploadStatus: 'ready' })

    const result = await method(makeRequest({ statusUrl: STATUS_URL }))

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/files/abc123/status')
    expect(result).toEqual({ uploadStatus: 'ready' })
  })

  test('takes over with the upload-not-found page when the backend has no record of the upload', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(apiError(404))
    const { h, response } = makeToolkit()

    const result = await method(makeRequest({ statusUrl: STATUS_URL }), h)

    expect(result).toBe(response)
    expect(h.view).toHaveBeenCalledWith('errors/upload-not-found', {
      pageTitle: 'We could not find your file upload',
      uploadPageUrl: '/upload/app-1'
    })
    expect(response.code).toHaveBeenCalledWith(404)
    expect(response.takeover).toHaveBeenCalled()
  })

  test('titles the upload-not-found page in Welsh on a /cy path', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(apiError(404))
    const { h } = makeToolkit()

    await method(
      makeRequest({ statusUrl: STATUS_URL }, '/cy/upload/app-1/status'),
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'errors/upload-not-found',
      expect.objectContaining({
        pageTitle: '[Welsh] We could not find your file upload'
      })
    )
  })

  test.each([
    ['a network failure', new Error('network down')],
    ['a backend 500', apiError(500)]
  ])('wraps %s as a 502', async (_label, error) => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(error)
    const { h } = makeToolkit()

    await expect(
      method(makeRequest({ statusUrl: STATUS_URL }), h)
    ).rejects.toMatchObject({
      message: 'CDP uploader status check failed',
      output: { statusCode: 502 }
    })
    expect(h.view).not.toHaveBeenCalled()
  })
})
