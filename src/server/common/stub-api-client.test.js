import { describe, test, expect, beforeEach, vi } from 'vitest'

// Each describe() reloads the module to avoid cross-test mutation of stub state.
// vi.resetModules() + dynamic import gives a clean in-memory store per group.

async function freshStub() {
  vi.resetModules()
  const m = await import('./stub-api-client.js')
  return m.stubApiClient
}

describe('stubApiClient.post — seed', () => {
  test('reprocessor seed (8-part URL) sets wasteProcessingType: reprocessor', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/100001/site001/Plastic/seed',
      { year: 2027 }
    )
    expect(result.wasteProcessingType).toBe('reprocessor')
    expect(result.applicationStatus).toBe('Saved')
    expect(result.yearlyMetrics.year).toBe('2027')
  })

  test('exporter seed (7-part URL) sets wasteProcessingType: exporter', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50005/Plastic/seed',
      { year: 2027 }
    )
    expect(result.wasteProcessingType).toBe('exporter')
    expect(result.applicationStatus).toBe('Saved')
    expect(result.yearlyMetrics.year).toBe('2027')
  })
})

describe('stubApiClient.post — BES evidence file upload', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const BES_URL =
    '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/bes-evidence/files'

  test('returns a fileId for a known app+site', async () => {
    const result = await stub.post(BES_URL, {
      filename: 'evidence.pdf',
      besEvidenceValidFromDate: '2026-01-01T00:00:00Z',
      besEvidenceExpiryDate: '2027-01-01T00:00:00Z'
    })
    expect(result.fileId).toMatch(/^stub-bes-/)
  })

  test('appends file to the site besEvidenceUploads array', async () => {
    await stub.post(BES_URL, { filename: 'doc.pdf' })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50006/app006exp'
    )
    const site = app.overseasSites.sites.find((s) => s.siteId === 900003)
    expect(site.besEvidence.besEvidenceUploads).toHaveLength(1)
    expect(site.besEvidence.besEvidenceUploads[0].filename).toBe('doc.pdf')
  })

  test('stores besEvidenceValidFromDate and besEvidenceExpiryDate on the file', async () => {
    await stub.post(BES_URL, {
      filename: 'cert.pdf',
      besEvidenceValidFromDate: '2026-03-01T00:00:00Z',
      besEvidenceExpiryDate: '2027-03-01T00:00:00Z'
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50006/app006exp'
    )
    const site = app.overseasSites.sites.find((s) => s.siteId === 900003)
    const file = site.besEvidence.besEvidenceUploads[0]
    expect(file.besEvidenceValidFromDate).toBe('2026-03-01T00:00:00Z')
    expect(file.besEvidenceExpiryDate).toBe('2027-03-01T00:00:00Z')
    expect(file.scanStatus).toBe('Clean')
  })

  test('no-op and still returns fileId when siteId not found', async () => {
    const result = await stub.post(
      '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/999999/bes-evidence/files',
      { filename: 'ignored.pdf' }
    )
    expect(result.fileId).toMatch(/^stub-bes-/)
  })
})

describe('stubApiClient.patch — BES evidence', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const BES_PATCH_URL =
    '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/bes-evidence'

  test('merges body into site besEvidence', async () => {
    await stub.patch(BES_PATCH_URL, { doYouWantToUploadMoreEvidence: true })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50006/app006exp'
    )
    const site = app.overseasSites.sites.find((s) => s.siteId === 900003)
    expect(site.besEvidence.doYouWantToUploadMoreEvidence).toBe(true)
  })

  test('returns empty object', async () => {
    const result = await stub.patch(BES_PATCH_URL, {
      doYouWantToUploadMoreEvidence: false
    })
    expect(result).toEqual({})
  })

  test('no-op when siteId not found', async () => {
    await expect(
      stub.patch(
        '/api/v1/accreditation-applications/org006exp/app006exp/overseas-sites/999999/bes-evidence',
        { doYouWantToUploadMoreEvidence: true }
      )
    ).resolves.toEqual({})
  })
})

describe('stubApiClient.delete — BES evidence file', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  test('removes the file from besEvidenceUploads', async () => {
    const app = await stub.get(
      '/api/v1/accreditation-applications/50004/app004exp'
    )
    const site = app.overseasSites?.sites?.find((s) => s.siteId === 900001)
    expect(site?.besEvidence?.besEvidenceUploads).toHaveLength(1)

    await stub.delete(
      '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/900001/bes-evidence/files/file003'
    )

    const updated = await stub.get(
      '/api/v1/accreditation-applications/50004/app004exp'
    )
    const updatedSite = updated.overseasSites?.sites?.find(
      (s) => s.siteId === 900001
    )
    expect(updatedSite?.besEvidence?.besEvidenceUploads).toHaveLength(0)
  })

  test('returns undefined', async () => {
    const result = await stub.delete(
      '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/900001/bes-evidence/files/file003'
    )
    expect(result).toBeUndefined()
  })

  test('no-op when fileId not found', async () => {
    await expect(
      stub.delete(
        '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/900001/bes-evidence/files/nonexistent'
      )
    ).resolves.toBeUndefined()
  })
})
