import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { persistentStubApiClient } from './persistentStubApiClient.js'
import { stubApiClient, stubCompleteUpload } from './stub-api-client.js'

describe('#persistentStubApiClient CDP upload status', () => {
  let fetchSpy

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  test('never calls the real backend for a /files/{id}/status lookup', async () => {
    const endpoint =
      '/api/v1/accreditation-applications/org1/app1/files/stub-upload-123/status'

    await persistentStubApiClient.get(endpoint)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('returns pending when the stub has no record of the upload yet', async () => {
    const result = await persistentStubApiClient.get(
      '/api/v1/accreditation-applications/org1/app1/files/never-completed/status'
    )

    expect(result).toEqual({
      uploadStatus: 'pending',
      processingStatus: 'preprocessing'
    })
  })

  // Regression guard for the bug this fixes: the real backend has no record of a
  // stub-generated fileUploadId and returns 200 "pending" for any id it doesn't
  // recognise, rather than an error — which previously masked a completed stub
  // upload behind a false "pending" that a poll loop never recovers from.
  test('reflects a completed stub upload as ready/validated once stubCompleteUpload has run', async () => {
    const endpoint =
      '/api/v1/accreditation-applications/org1/app1/files/stub-upload-999/status'

    stubCompleteUpload('stub-upload-999', {
      filename: 'sampling-plan.pdf',
      contentType: 'application/pdf'
    })

    const result = await persistentStubApiClient.get(endpoint)

    expect(result.uploadStatus).toBe('ready')
    expect(result.processingStatus).toBe('validated')
    expect(result.form.file.filename).toBe('sampling-plan.pdf')
  })

  test('delegates to stubApiClient.get for the status endpoint', async () => {
    const endpoint =
      '/api/v1/accreditation-applications/org1/app1/files/abc/status'
    const stubGetSpy = vi.spyOn(stubApiClient, 'get')

    await persistentStubApiClient.get(endpoint)

    expect(stubGetSpy).toHaveBeenCalledWith(endpoint)
    stubGetSpy.mockRestore()
  })
})
