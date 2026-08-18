import { describe, test, expect, vi, afterEach } from 'vitest'

import { fetchStatus } from './fetch-status.js'
import { config } from '../../../../config/config.js'

describe('#fetchStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('GETs the CDP uploader status endpoint and returns the parsed JSON', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ uploadStatus: 'ready' })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchStatus('upload-123')

    expect(result).toEqual({ uploadStatus: 'ready' })
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe(
      `${config.get('fileUpload.cdpUploaderUrl')}/status/upload-123`
    )
    expect(options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
  })

  test('throws when the CDP uploader responds not-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway'
      })
    )

    await expect(fetchStatus('upload-456')).rejects.toThrow(
      'CDP uploader status check failed: 502 Bad Gateway'
    )
  })
})
