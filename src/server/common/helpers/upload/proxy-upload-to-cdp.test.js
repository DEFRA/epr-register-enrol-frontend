import { createServer } from 'node:http'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { proxyUploadToCdp } from './proxy-upload-to-cdp.js'

const realFetch = globalThis.fetch

describe('#proxyUploadToCdp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
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

  test('posts the upload url with a manual redirect and no hand-set headers', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await proxyUploadToCdp({
      uploadUrl: 'http://cdp-uploader/upload/abc',
      payload: Buffer.from('file-bytes'),
      filename: 'plan.pdf',
      contentType: 'application/pdf'
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('http://cdp-uploader/upload/abc')
    expect(options.method).toBe('POST')
    expect(options.redirect).toBe('manual')
    // fetch must set the multipart Content-Type itself (it owns the boundary), and
    // the filename must not travel as a header at all — see the RA-619 tests below.
    expect(options.headers).toBeUndefined()
  })

  // RA-619: a request header value must be Latin-1, so a filename holding any character
  // above U+00FF made fetch() throw before the request was sent. The filename now rides
  // in the multipart body (a UTF-8 Content-Disposition line), which has no such limit.
  describe('RA-619: filenames with characters outside Latin-1', () => {
    async function sentFilePart({ filename, contentType = 'application/pdf' }) {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

      await proxyUploadToCdp({
        uploadUrl: 'http://cdp-uploader/upload/abc',
        payload: Buffer.from('file-bytes'),
        filename,
        contentType
      })

      const { body } = global.fetch.mock.calls[0][1]
      return body
    }

    test.each([
      ['Vietnamese diacritics', 'Báo cáo kiểm tra ẻ.pdf'],
      ['CJK only', '报告.pdf'],
      ['emoji', '🚀 upload.pdf'],
      ['Latin-1 accents (worked before)', 'café résumé.pdf'],
      ['plain ASCII', 'plan.pdf']
    ])(
      'sends %s byte-exact as the multipart file part',
      async (_label, filename) => {
        const body = await sentFilePart({ filename })

        expect(body).toBeInstanceOf(FormData)
        const part = body.get('file')
        expect(part.name).toBe(filename)
        expect(part.type).toBe('application/pdf')
        expect(Buffer.from(await part.arrayBuffer())).toEqual(
          Buffer.from('file-bytes')
        )
      }
    )

    test('sends exactly one part, named "file", which the status response reads back as form.file', async () => {
      const body = await sentFilePart({ filename: '报告.pdf' })

      expect([...body.keys()]).toEqual(['file'])
    })

    test('does not throw for a filename above U+00FF when the real fetch builds the request', async () => {
      // Only the network is faked: the same Headers/FormData machinery that threw in
      // production runs for real, so this fails on the old header-based code.
      let received = ''
      const server = createServer((req, res) => {
        req.on('data', (chunk) => (received += chunk.toString('utf8')))
        req.on('end', () => res.writeHead(302, { location: '/done' }).end())
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

      try {
        await expect(
          proxyUploadToCdp({
            uploadUrl: `http://127.0.0.1:${server.address().port}/upload/abc`,
            payload: Buffer.from('file-bytes'),
            filename: 'Báo cáo kiểm tra ẻ.pdf',
            contentType: 'application/pdf'
          })
        ).resolves.toBeUndefined()

        // The name reached the wire intact, as UTF-8 in the part's Content-Disposition.
        expect(received).toContain('filename="Báo cáo kiểm tra ẻ.pdf"')
      } finally {
        await new Promise((resolve) => server.close(resolve))
      }
    })
  })
})
