import { describe, test, expect, beforeEach, vi } from 'vitest'

// Each describe reloads the module to avoid cross-test mutation of stub state.
// vi.resetModules() + dynamic import gives a clean in-memory store per group.

async function freshStub() {
  vi.resetModules()
  const m = await import('./stub-api-client.js')
  return m.stubApiClient
}

describe('stubApiClient.post — seed', () => {
  test('reprocessor seed (8-part URL) sets IsExporter: false', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/org001/site001/Plastic/seed',
      { year: 2027 }
    )
    expect(result.IsExporter).toBe(false)
    expect(result.ApplicationStatus).toBe('Saved')
    expect(result.Year).toBe(2027)
  })

  test('exporter seed (7-part URL) sets IsExporter: true', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/org005exp/Plastic/seed',
      { year: 2027 }
    )
    expect(result.IsExporter).toBe(true)
    expect(result.ApplicationStatus).toBe('Saved')
    expect(result.Year).toBe(2027)
  })
})

describe('stubApiClient.post — BES evidence file upload', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const BES_URL =
    '/api/v1/accreditation-applications/org006exp/app006exp/overseas-sites/900003/bes-evidence/files'

  test('returns a FileId for a known app+site', async () => {
    const result = await stub.post(BES_URL, {
      Filename: 'evidence.pdf',
      BESEvidenceValidFromDate: '2026-01-01T00:00:00Z',
      BESEvidenceExpiryDate: '2027-01-01T00:00:00Z'
    })
    expect(result.FileId).toMatch(/^stub-bes-/)
  })

  test('appends file to the site BESEvidenceUploads array', async () => {
    await stub.post(BES_URL, { Filename: 'doc.pdf' })

    const app = await stub.get(
      '/api/v1/accreditation-applications/org006exp/app006exp'
    )
    const site = app.OverseasSites.Sites.find((s) => s.SiteId === 900003)
    expect(site.BESEvidence.BESEvidenceUploads).toHaveLength(1)
    expect(site.BESEvidence.BESEvidenceUploads[0].Filename).toBe('doc.pdf')
  })

  test('stores BESEvidenceValidFromDate and BESEvidenceExpiryDate on the file', async () => {
    await stub.post(BES_URL, {
      Filename: 'cert.pdf',
      BESEvidenceValidFromDate: '2026-03-01T00:00:00Z',
      BESEvidenceExpiryDate: '2027-03-01T00:00:00Z'
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/org006exp/app006exp'
    )
    const site = app.OverseasSites.Sites.find((s) => s.SiteId === 900003)
    const file = site.BESEvidence.BESEvidenceUploads[0]
    expect(file.BESEvidenceValidFromDate).toBe('2026-03-01T00:00:00Z')
    expect(file.BESEvidenceExpiryDate).toBe('2027-03-01T00:00:00Z')
    expect(file.ScanStatus).toBe('Clean')
  })

  test('no-op and still returns FileId when siteId not found', async () => {
    const result = await stub.post(
      '/api/v1/accreditation-applications/org006exp/app006exp/overseas-sites/999999/bes-evidence/files',
      { Filename: 'ignored.pdf' }
    )
    expect(result.FileId).toMatch(/^stub-bes-/)
  })
})

describe('stubApiClient.patch — BES evidence', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const BES_PATCH_URL =
    '/api/v1/accreditation-applications/org006exp/app006exp/overseas-sites/900003/bes-evidence'

  test('merges body into site BESEvidence', async () => {
    await stub.patch(BES_PATCH_URL, { DoYouWantToUploadMoreEvidence: true })

    const app = await stub.get(
      '/api/v1/accreditation-applications/org006exp/app006exp'
    )
    const site = app.OverseasSites.Sites.find((s) => s.SiteId === 900003)
    expect(site.BESEvidence.DoYouWantToUploadMoreEvidence).toBe(true)
  })

  test('returns empty object', async () => {
    const result = await stub.patch(BES_PATCH_URL, {
      DoYouWantToUploadMoreEvidence: false
    })
    expect(result).toEqual({})
  })

  test('no-op when siteId not found', async () => {
    await expect(
      stub.patch(
        '/api/v1/accreditation-applications/org006exp/app006exp/overseas-sites/999999/bes-evidence',
        { DoYouWantToUploadMoreEvidence: true }
      )
    ).resolves.toEqual({})
  })
})

describe('stubApiClient.delete — BES evidence file', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  test('removes the file from BESEvidenceUploads', async () => {
    const app = await stub.get(
      '/api/v1/accreditation-applications/org004exp/app004exp'
    )
    const site = app.OverseasSites?.Sites?.find((s) => s.SiteId === 900001)
    expect(site?.BESEvidence?.BESEvidenceUploads).toHaveLength(1)

    await stub.delete(
      '/api/v1/accreditation-applications/org004exp/app004exp/overseas-sites/900001/bes-evidence/files/file003'
    )

    const updated = await stub.get(
      '/api/v1/accreditation-applications/org004exp/app004exp'
    )
    const updatedSite = updated.OverseasSites?.Sites?.find(
      (s) => s.SiteId === 900001
    )
    expect(updatedSite?.BESEvidence?.BESEvidenceUploads).toHaveLength(0)
  })

  test('returns undefined', async () => {
    const result = await stub.delete(
      '/api/v1/accreditation-applications/org004exp/app004exp/overseas-sites/900001/bes-evidence/files/file003'
    )
    expect(result).toBeUndefined()
  })

  test('no-op when fileId not found', async () => {
    await expect(
      stub.delete(
        '/api/v1/accreditation-applications/org004exp/app004exp/overseas-sites/900001/bes-evidence/files/nonexistent'
      )
    ).resolves.toBeUndefined()
  })
})
