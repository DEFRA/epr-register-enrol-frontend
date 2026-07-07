import { describe, test, expect, vi, beforeEach } from 'vitest'
import { proxyUploadToCdp } from './proxy-upload-to-cdp.js'

describe('#proxyUploadToCdp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('resolves for a genuine 2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await expect(
      proxyUploadToCdp({
        uploadUrl: 'http://cdp-uploader/upload/abc',
        payload: Buffer.from('file-bytes'),
        filename: 'plan.pdf',
        contentType: 'application/pdf'
      })
    ).resolves.toBeUndefined()
  })

  test('resolves for an opaque-redirect response (browser-spec-compliant fetch)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 0,
      type: 'opaqueredirect'
    })

    await expect(
      proxyUploadToCdp({
        uploadUrl: 'http://cdp-uploader/upload/abc',
        payload: Buffer.from('file-bytes'),
        filename: 'plan.pdf',
        contentType: 'application/pdf'
      })
    ).resolves.toBeUndefined()
  })

  test("resolves for a literal 3xx response with a non-opaque type — Node fetch's real behaviour", async () => {
    // Regression guard: Node's native fetch() doesn't collapse a manual-redirect 3xx
    // into an opaque-redirect response the way the Fetch spec describes for browsers —
    // the real status/type come through instead. This must still be treated as a
    // successful upload, not a failure — this was the cause of every real upload
    // failing against cdp-uploader.
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      type: 'basic'
    })

    await expect(
      proxyUploadToCdp({
        uploadUrl: 'http://cdp-uploader/upload/abc',
        payload: Buffer.from('file-bytes'),
        filename: 'plan.pdf',
        contentType: 'application/pdf'
      })
    ).resolves.toBeUndefined()
  })

  test('throws for a genuine non-2xx/3xx failure response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      type: 'basic'
    })

    await expect(
      proxyUploadToCdp({
        uploadUrl: 'http://cdp-uploader/upload/abc',
        payload: Buffer.from('file-bytes'),
        filename: 'plan.pdf',
        contentType: 'application/pdf'
      })
    ).rejects.toThrow('CDP proxy upload failed: 500')
  })

  test('calls fetch with the upload url, manual redirect, and the file details', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await proxyUploadToCdp({
      uploadUrl: 'http://cdp-uploader/upload/abc',
      payload: Buffer.from('file-bytes'),
      filename: 'plan.pdf',
      contentType: 'application/pdf'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://cdp-uploader/upload/abc',
      {
        method: 'POST',
        body: Buffer.from('file-bytes'),
        duplex: 'half',
        redirect: 'manual',
        headers: {
          'x-filename': 'plan.pdf',
          'Content-Type': 'application/pdf'
        }
      }
    )
  })
})
