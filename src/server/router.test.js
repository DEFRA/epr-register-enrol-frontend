import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'
import { stubApiClient } from './common/stub-api-client.js'

// The stub CDP upload endpoint (registered only when config.api.stubEnabled
// is true, the default for local dev and this test suite) marks a
// fileUploadId as ready so a later status poll returns it.

describe('#router — stub CDP upload endpoint', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('marks the upload ready using the supplied filename and content-type headers', async () => {
    const fileUploadId = 'router-test-upload-001'

    const { statusCode } = await server.inject({
      method: 'POST',
      url: `/api/stub/upload/${fileUploadId}`,
      headers: {
        'x-filename': 'evidence.pdf',
        'content-type': 'application/pdf'
      },
      payload: Buffer.from('file-bytes')
    })

    expect(statusCode).toBe(statusCodes.ok)

    const status = await stubApiClient.get(`/files/${fileUploadId}/status`)

    expect(status.uploadStatus).toBe('ready')
    expect(status.form.file.filename).toBe('evidence.pdf')
    expect(status.form.file.contentType).toBe('application/pdf')
  })

  test('defaults filename and content-type when the headers are not supplied', async () => {
    const fileUploadId = 'router-test-upload-002'

    const { statusCode } = await server.inject({
      method: 'POST',
      url: `/api/stub/upload/${fileUploadId}`,
      payload: Buffer.from('file-bytes')
    })

    expect(statusCode).toBe(statusCodes.ok)

    const status = await stubApiClient.get(`/files/${fileUploadId}/status`)

    expect(status.form.file.filename).toBe('unknown')
    expect(status.form.file.contentType).toBe('application/octet-stream')
  })
})
