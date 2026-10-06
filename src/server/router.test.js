import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'
import { stubApiClient } from './common/stub-api-client.js'

// The stub CDP upload endpoint (registered only when config.api.stubEnabled
// is true, the default for local dev and this test suite) marks a
// fileUploadId as ready so a later status poll returns it.
//
// RA-619: the frontend now posts uploads to CDP as a multipart form (a header
// value can't carry a filename above U+00FF), so the stub reads the filename and
// content type from the multipart `file` part, exactly as cdp-uploader does.

const BOUNDARY = '----ra619-test-boundary'

// server.inject() takes a raw payload, so the multipart body is built by hand. The
// filename is written as UTF-8, which is what fetch()'s FormData puts on the wire.
function multipartPayload(parts) {
  const chunks = parts.flatMap(({ name, filename, contentType, content }) => [
    Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="${name}"` +
        (filename === undefined ? '' : `; filename="${filename}"`) +
        '\r\n' +
        (contentType ? `Content-Type: ${contentType}\r\n` : '') +
        '\r\n',
      'utf8'
    ),
    Buffer.from(content),
    Buffer.from('\r\n')
  ])
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))
  return Buffer.concat(chunks)
}

describe('#router — stub CDP upload endpoint', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  function postUpload(fileUploadId, parts) {
    return server.inject({
      method: 'POST',
      url: `/api/stub/upload/${fileUploadId}`,
      headers: {
        'content-type': `multipart/form-data; boundary=${BOUNDARY}`
      },
      payload: multipartPayload(parts)
    })
  }

  test('marks the upload ready using the filename and content type of the multipart file part', async () => {
    const fileUploadId = 'router-test-upload-001'

    const { statusCode } = await postUpload(fileUploadId, [
      {
        name: 'file',
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
        content: 'file-bytes'
      }
    ])

    expect(statusCode).toBe(statusCodes.ok)

    const status = await stubApiClient.get(`/files/${fileUploadId}/status`)

    expect(status.uploadStatus).toBe('ready')
    expect(status.form.file.filename).toBe('evidence.pdf')
    expect(status.form.file.contentType).toBe('application/pdf')
  })

  test.each([
    ['Vietnamese diacritics', 'Báo cáo kiểm tra ẻ.pdf'],
    ['CJK only', '报告.pdf'],
    ['emoji', '🚀 upload.pdf']
  ])(
    'RA-619: records %s exactly as the user chose it',
    async (_label, filename) => {
      const fileUploadId = `router-test-upload-ra619-${_label.replace(/\W+/g, '-')}`

      const { statusCode } = await postUpload(fileUploadId, [
        {
          name: 'file',
          filename,
          contentType: 'application/pdf',
          content: 'file-bytes'
        }
      ])

      expect(statusCode).toBe(statusCodes.ok)

      const status = await stubApiClient.get(`/files/${fileUploadId}/status`)

      expect(status.form.file.filename).toBe(filename)
    }
  )

  test('rejects a request that carries no multipart file part', async () => {
    const { statusCode } = await postUpload('router-test-upload-002', [
      { name: 'documentType', content: 'SamplingPlan' }
    ])

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('does not honour the retired raw-body x-filename upload', async () => {
    const fileUploadId = 'router-test-upload-003'

    // Hapi refuses a non-multipart body before the handler runs (415), so the old
    // header-based request can no longer mark an upload ready.
    const { statusCode } = await server.inject({
      method: 'POST',
      url: `/api/stub/upload/${fileUploadId}`,
      headers: {
        'x-filename': 'evidence.pdf',
        'content-type': 'application/pdf'
      },
      payload: Buffer.from('file-bytes')
    })

    expect(statusCode).toBe(415)

    const status = await stubApiClient.get(`/files/${fileUploadId}/status`)

    expect(status.form?.file?.filename).not.toBe('evidence.pdf')
  })
})
