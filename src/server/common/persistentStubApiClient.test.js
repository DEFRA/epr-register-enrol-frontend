import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { persistentStubApiClient } from './persistentStubApiClient.js'
import { stubApiClient, stubCompleteUpload } from './stub-api-client.js'
import { config } from '../../config/config.js'

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

describe('#persistentStubApiClient defra-link', () => {
  let fetchSpy

  beforeEach(() => {
    // Force the backend-unreachable path so the stub map is exercised.
    fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('backend down'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('maps a numeric ReEx org id to the same Defra org id', async () => {
    const result = await persistentStubApiClient.get(
      '/api/v1/organisations/50002/defra-link'
    )
    expect(result).toEqual({
      organisationId: '50002',
      linkedDefraOrganisationId: '50002'
    })
  })

  test('maps the ObjectId-shaped ReEx org id to its distinct Defra UUID', async () => {
    const result = await persistentStubApiClient.get(
      '/api/v1/organisations/6a2fcd74e16883c137d01188/defra-link'
    )
    expect(result.linkedDefraOrganisationId).toBe(
      '67b9e8fc-2235-431a-a7b9-80663c81b6ff'
    )
  })

  test('returns a null link for an unmapped org id (fails closed)', async () => {
    const result = await persistentStubApiClient.get(
      '/api/v1/organisations/not-a-real-org/defra-link'
    )
    expect(result.linkedDefraOrganisationId).toBeNull()
  })

  test('passes through the real backend response when reachable', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        organisationId: '50002',
        linkedDefraOrganisationId: 909999
      })
    })

    const result = await persistentStubApiClient.get(
      '/api/v1/organisations/50002/defra-link'
    )
    expect(result.linkedDefraOrganisationId).toBe(909999)
  })

  test('sends the shared-secret Bearer token on the real backend call', async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'api.sharedSecret' ? 'test-secret' : originalGet(key)
    )
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        organisationId: '50002',
        linkedDefraOrganisationId: '50002'
      })
    })

    await persistentStubApiClient.get('/api/v1/organisations/50002/defra-link')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-secret' }
      })
    )
  })
})

describe('#persistentStubApiClient get — application list', () => {
  const LIST_URL = '/api/v1/accreditation-applications/50001'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('falls back to the stub when the backend is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await persistentStubApiClient.get(LIST_URL)

    expect(Array.isArray(result)).toBe(true)
    expect(result[0].companyName).toBe('NEWDEV RECYCLING LIMITED')
  })

  test('falls back to the stub when the backend responds not-ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false })

    const result = await persistentStubApiClient.get(LIST_URL)

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  test('falls back to the stub when the backend returns an empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => []
    })

    const result = await persistentStubApiClient.get(LIST_URL)

    expect(result.length).toBeGreaterThan(0)
  })

  test('overlays the stub company name onto a non-empty backend response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ orgId: 50001, id: 'app001', material: 'plastic' }]
    })

    const result = await persistentStubApiClient.get(LIST_URL)

    expect(result).toEqual([
      {
        orgId: 50001,
        id: 'app001',
        material: 'plastic',
        companyName: 'NEWDEV RECYCLING LIMITED'
      }
    ])
  })

  test('leaves an item unchanged if its orgId has no matching stub doc', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ orgId: 999999, id: 'app-x' }]
    })

    const result = await persistentStubApiClient.get(LIST_URL)

    expect(result).toEqual([{ orgId: 999999, id: 'app-x' }])
  })
})

describe('#persistentStubApiClient get — single application', () => {
  const SINGLE_URL = '/api/v1/accreditation-applications/50001/app001'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns the backend response when reachable', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ orgId: 50001, id: 'app001', fromBackend: true })
    })

    const result = await persistentStubApiClient.get(SINGLE_URL)

    expect(result.fromBackend).toBe(true)
  })

  test('falls back to the stub when the backend responds not-ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false })

    const result = await persistentStubApiClient.get(SINGLE_URL)

    expect(result.orgId).toBe(50001)
    expect(result.fromBackend).toBeUndefined()
  })

  test('falls back to the stub when the backend request throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await persistentStubApiClient.get(SINGLE_URL)

    expect(result.orgId).toBe(50001)
  })
})

describe('#persistentStubApiClient post', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('/initiate delegates straight to the stub without calling the backend', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/app001/files/initiate',
      {}
    )
    expect(result.fileUploadId).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('/seed mirrors the stub result to the backend when orgId and appId resolve', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/site001/Plastic/seed',
      { year: 2027 }
    )

    expect(result.wasteProcessingType).toBe('reprocessor')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toContain('/api/v1/stub/accreditation-applications/50001/')
    expect(options.method).toBe('PUT')
  })

  test('/seed swallows a backend PUT failure and still returns the stub result', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('backend down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/site001/Plastic/seed',
      { year: 2027 }
    )

    expect(result.wasteProcessingType).toBe('reprocessor')
    expect(warnSpy).toHaveBeenCalled()
  })

  test('/submit mirrors the updated application to the backend', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/app001/submit',
      { name: 'Jane Doe', email: 'jane@example.com', jobTitle: 'Manager' }
    )

    expect(result.accreditationReference).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain(
      '/api/v1/stub/accreditation-applications/50001/app001'
    )
  })

  test('/files mirrors the updated application to the backend after an upload', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/app001/files',
      { filename: 'plan.pdf' }
    )

    expect(result.fileId).toBeDefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('any other endpoint is passed straight through to the stub', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const result = await persistentStubApiClient.post(
      '/api/v1/accreditation-applications/50001/app001/withdraw',
      { reason: 'no longer needed' }
    )
    expect(result.applicationStatus).toBe('Withdrawn')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('#persistentStubApiClient patch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('mirrors the patched section to the backend', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await persistentStubApiClient.patch(
      '/api/v1/accreditation-applications/50001/app001/tonnage',
      { plannedTonnageBand: 'UpTo5000' }
    )

    expect(result.prnIssuance.plannedIssuance).toBe('UpTo5000')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain(
      '/api/v1/stub/accreditation-applications/50001/app001'
    )
  })

  test('swallows a backend PUT failure and still returns the stub result', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await persistentStubApiClient.patch(
      '/api/v1/accreditation-applications/50001/app001/tonnage',
      { plannedTonnageBand: 'UpTo10000' }
    )

    expect(result.prnIssuance.plannedIssuance).toBe('UpTo10000')
  })
})

describe('#persistentStubApiClient put', () => {
  test('delegates directly to the stub', async () => {
    const result = await persistentStubApiClient.put(
      '/api/v1/accreditation-applications/50001/app001',
      {}
    )
    expect(result).toEqual({})
  })
})

describe('#persistentStubApiClient delete', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('mirrors the updated application to the backend after deleting a file', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({}) })

    await persistentStubApiClient.delete(
      '/api/v1/accreditation-applications/50004/app004exp/files/file003'
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain(
      '/api/v1/stub/accreditation-applications/50004/app004exp'
    )
  })

  test('does not call the backend for a non-file delete endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    await persistentStubApiClient.delete(
      '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/bes-evidence/files/file123'
    )

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
