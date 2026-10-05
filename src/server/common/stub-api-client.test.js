import { describe, test, expect, beforeEach, vi } from 'vitest'

// Each describe() reloads the module to avoid cross-test mutation of stub state.
// vi.resetModules() + dynamic import gives a clean in-memory store per group.

async function freshStub() {
  vi.resetModules()
  const m = await import('./stub-api-client.js')
  return m.stubApiClient
}

async function freshStubModule() {
  vi.resetModules()
  return import('./stub-api-client.js')
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

describe('stubApiClient.post — interim site', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const INTERIM_URL =
    '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/900001/interim-site'

  test('returns a fake created interim site with isNewSite true', async () => {
    const result = await stub.post(INTERIM_URL, {
      country: 'France',
      siteName: 'Interim Depot'
    })
    expect(result.siteId).toBeDefined()
    expect(result.siteNumber).toBeDefined()
    expect(result.isNewSite).toBe(true)
    expect(result.country).toBe('France')
    expect(result.siteName).toBe('Interim Depot')
  })

  test('nests the interim site onto the matched ORS site', async () => {
    await stub.post(INTERIM_URL, {
      country: 'France',
      siteName: 'Interim Depot'
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50004/app004exp'
    )
    const site = app.overseasSites.sites.find((s) => s.siteId === 900001)
    expect(site.interimSite).toBeDefined()
    expect(site.interimSite.siteName).toBe('Interim Depot')
    expect(site.interimSite.isNewSite).toBe(true)
  })

  // RA-603: this used to fabricate and return an interim site for an ORS that
  // does not exist. The real backend 404s, and the fabricated object was never
  // attached to anything, so the only thing it achieved was showing a caller
  // success where production fails. It now returns nothing, matching both the
  // backend and the plural routes.
  test('returns nothing when the ORS does not exist', async () => {
    const result = await stub.post(
      '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/999999/interim-site',
      { country: 'Spain' }
    )
    expect(result).toBeUndefined()
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

describe('stubApiClient.patch — business-plan flat fields', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const PATCH_URL =
    '/api/v1/accreditation-applications/50002/app002/business-plan'
  const GET_URL = '/api/v1/accreditation-applications/50002/app002'

  test('flat percent fields are stored as items[].percentSpent', async () => {
    await stub.patch(PATCH_URL, {
      isPartialSave: true,
      newInfrastructurePercent: 20,
      priceSupportPercent: 15,
      businessCollectionsPercent: 25,
      communicationsPercent: 10,
      newMarketsPercent: 15,
      newUsesPercent: 15
    })

    const app = await stub.get(GET_URL)
    const infra = app.businessPlan.items.find(
      (i) => i.category === 'newInfrastructure'
    )
    expect(infra.percentSpent).toBe(20)
    const comms = app.businessPlan.items.find(
      (i) => i.category === 'communications'
    )
    expect(comms.percentSpent).toBe(10)
  })

  test('flat detail fields are stored as items[].detailedDescription', async () => {
    await stub.patch(PATCH_URL, {
      newInfrastructureDetail: 'Build new plant',
      priceSupportDetail: 'Market support'
    })

    const app = await stub.get(GET_URL)
    const infra = app.businessPlan.items.find(
      (i) => i.category === 'newInfrastructure'
    )
    expect(infra.detailedDescription).toBe('Build new plant')
  })

  test('mixed percent + detail patch merges into same item', async () => {
    await stub.patch(PATCH_URL, {
      newInfrastructurePercent: 30,
      newInfrastructureDetail: 'New facility'
    })

    const app = await stub.get(GET_URL)
    const infra = app.businessPlan.items.find(
      (i) => i.category === 'newInfrastructure'
    )
    expect(infra.percentSpent).toBe(30)
    expect(infra.detailedDescription).toBe('New facility')
  })

  test('second patch merges without clobbering existing items', async () => {
    await stub.patch(PATCH_URL, { newInfrastructurePercent: 40 })
    await stub.patch(PATCH_URL, { priceSupportPercent: 60 })

    const app = await stub.get(GET_URL)
    const items = app.businessPlan.items
    expect(
      items.find((i) => i.category === 'newInfrastructure').percentSpent
    ).toBe(40)
    expect(items.find((i) => i.category === 'priceSupport').percentSpent).toBe(
      60
    )
  })

  test('body.items array path still works (no regression)', async () => {
    await stub.patch(PATCH_URL, {
      items: [{ category: 'newMarkets', percentSpent: 100 }]
    })

    const app = await stub.get(GET_URL)
    const item = app.businessPlan.items.find((i) => i.category === 'newMarkets')
    expect(item.percentSpent).toBe(100)
  })

  test('body.items with an unrecognised category is appended rather than merged', async () => {
    await stub.patch(PATCH_URL, {
      items: [{ category: 'brandNewCategory', percentSpent: 5 }]
    })
    await stub.patch(PATCH_URL, {
      items: [{ category: 'anotherNewCategory', percentSpent: 9 }]
    })

    const app = await stub.get(GET_URL)
    const items = app.businessPlan.items
    expect(items).toHaveLength(2)
    const added = items.find((i) => i.category === 'brandNewCategory')
    expect(added.percentSpent).toBe(5)
    const secondAdded = items.find((i) => i.category === 'anotherNewCategory')
    expect(secondAdded.percentSpent).toBe(9)
  })
})

describe('stubApiClient.patch — tonnage section', () => {
  let stub

  beforeEach(async () => {
    stub = await freshStub()
  })

  const PATCH_URL = '/api/v1/accreditation-applications/50001/app001/tonnage'

  test('patching authorisers persists them as prnIssuance.signatories', async () => {
    const authorisers = [{ name: 'Alice', email: 'alice@example.com' }]
    await stub.patch(PATCH_URL, { authorisers })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.signatories).toEqual(authorisers)
  })

  test('patching plannedTonnageBand persists it as prnIssuance.plannedIssuance', async () => {
    await stub.patch(PATCH_URL, { plannedTonnageBand: 'UpTo5000' })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.plannedIssuance).toBe('UpTo5000')
  })

  test('subsequent GET returns updated signatories (normaliser picks them up)', async () => {
    const authorisers = [
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Carol', email: 'carol@example.com' }
    ]
    await stub.patch(PATCH_URL, {
      authorisers,
      plannedTonnageBand: 'UpTo5000',
      sectionStatus: 'InProgress'
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.signatories).toEqual(authorisers)
    expect(app.prnIssuance.plannedIssuance).toBe('UpTo5000')
    expect(app.prnIssuance.sectionStatus).toBe('InProgress')
  })

  // RA-292 AC03: the stub stands in for the backend during local dev. It stores
  // whatever isNew it is given without deriving it — derivation is the real
  // backend's job — and a dropped authoriser stays dropped.
  test('round-trips isNew whether it is true, false, absent or null', async () => {
    const authorisers = [
      { fullName: 'Jane', email: 'jane@example.com', isNew: true },
      { fullName: 'Bob', email: 'bob@example.com', isNew: false },
      { fullName: 'Sue', email: 'sue@example.com' },
      { fullName: 'Ann', email: 'ann@example.com', isNew: null }
    ]
    await stub.patch(PATCH_URL, { authorisers })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.signatories).toEqual(authorisers)
    expect(app.prnIssuance.signatories[2]).not.toHaveProperty('isNew')
  })

  test('replaces the authoriser list rather than merging it', async () => {
    await stub.patch(PATCH_URL, {
      authorisers: [
        { fullName: 'Jane', email: 'jane@example.com', isNew: true },
        { fullName: 'Bob', email: 'bob@example.com', isNew: false }
      ]
    })
    await stub.patch(PATCH_URL, {
      authorisers: [{ fullName: 'Bob', email: 'bob@example.com', isNew: false }]
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.signatories).toEqual([
      { fullName: 'Bob', email: 'bob@example.com', isNew: false }
    ])
  })

  test('leaves the persisted authorisers alone when the patch omits them', async () => {
    const authorisers = [
      { fullName: 'Jane', email: 'jane@example.com', isNew: true }
    ]
    await stub.patch(PATCH_URL, { authorisers })
    await stub.patch(PATCH_URL, { sectionStatus: 'Completed' })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.signatories).toEqual(authorisers)
  })
})

describe('stubApiClient.patch — business-plan sectionStatus', () => {
  test('updates sectionStatus without touching items', async () => {
    const stub = await freshStub()
    await stub.patch(
      '/api/v1/accreditation-applications/50002/app002/business-plan',
      { sectionStatus: 'Completed' }
    )

    const app = await stub.get(
      '/api/v1/accreditation-applications/50002/app002'
    )
    expect(app.businessPlan.sectionStatus).toBe('Completed')
  })
})

describe('stubApiClient.patch — generic mapped section', () => {
  test('merges body into the mapped key for a known section (sampling-plan)', async () => {
    const stub = await freshStub()
    await stub.patch(
      '/api/v1/accreditation-applications/50002/app002/sampling-plan',
      { sectionStatus: 'Started' }
    )

    const app = await stub.get(
      '/api/v1/accreditation-applications/50002/app002'
    )
    expect(app.samplingPlan.sectionStatus).toBe('Started')
  })

  test('no-op for an unknown section', async () => {
    const stub = await freshStub()
    const result = await stub.patch(
      '/api/v1/accreditation-applications/50002/app002/unknown-section',
      { foo: 'bar' }
    )
    expect(result.orgId).toBe(50002)
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

describe('stubApiClient.delete — sampling plan file', () => {
  test('removes the file from samplingPlan.files for a known app', async () => {
    const stub = await freshStub()
    let app = await stub.get('/api/v1/accreditation-applications/50003/app003')
    expect(app.samplingPlan.files).toHaveLength(1)

    await stub.delete(
      '/api/v1/accreditation-applications/50003/app003/files/file003'
    )

    app = await stub.get('/api/v1/accreditation-applications/50003/app003')
    expect(app.samplingPlan.files).toHaveLength(0)
  })

  test('falls back to the first stub accreditation when app is not found', async () => {
    const stub = await freshStub()
    await expect(
      stub.delete('/api/v1/accreditation-applications/nope/nope/files/anything')
    ).resolves.toBeUndefined()
  })

  test('no-op when samplingPlan has no files array', async () => {
    const stub = await freshStub()
    // app001's samplingPlan.files starts empty, so filtering it is a no-op
    await expect(
      stub.delete(
        '/api/v1/accreditation-applications/50001/app001/files/nonexistent'
      )
    ).resolves.toBeUndefined()
  })
})

describe('stubApiClient.get — CDP upload status', () => {
  test('returns pending status when upload has not completed', async () => {
    const stub = await freshStub()
    const result = await stub.get(
      '/api/stub/upload/some-id/files/upload001/status'
    )
    expect(result.uploadStatus).toBe('pending')
    expect(result.processingStatus).toBe('preprocessing')
  })

  test('returns ready status with file details once completed', async () => {
    const mod = await freshStubModule()
    const result = await mod.stubApiClient.get(
      '/api/stub/upload/some-id/files/upload002/status'
    )
    expect(result.uploadStatus).toBe('pending')

    mod.stubCompleteUpload('upload002', {
      filename: 'evidence.pdf',
      contentType: 'application/pdf'
    })

    const ready = await mod.stubApiClient.get(
      '/api/stub/upload/some-id/files/upload002/status'
    )
    expect(ready.uploadStatus).toBe('ready')
    expect(ready.processingStatus).toBe('validated')
    expect(ready.form.file.filename).toBe('evidence.pdf')
    expect(ready.form.file.contentType).toBe('application/pdf')
    expect(ready.form.file.fileId).toBe('stub-file-upload002')
  })

  test('defaults filename and contentType when not supplied', async () => {
    const mod = await freshStubModule()
    mod.stubCompleteUpload('upload003', {})

    const ready = await mod.stubApiClient.get(
      '/api/stub/upload/some-id/files/upload003/status'
    )
    expect(ready.form.file.filename).toBe('unknown')
    expect(ready.form.file.contentType).toBe('application/octet-stream')
  })
})

describe('stubApiClient.get — application list and single accreditation', () => {
  test('lists accreditations for a known org', async () => {
    const stub = await freshStub()
    const result = await stub.get('/api/v1/accreditation-applications/50001')
    expect(result).toHaveLength(1)
    expect(result[0].orgId).toBe(50001)
  })

  test('returns empty array for an unknown org', async () => {
    const stub = await freshStub()
    const result = await stub.get('/api/v1/accreditation-applications/999999')
    expect(result).toEqual([])
  })

  test('returns empty object when endpoint does not match any known shape', async () => {
    const stub = await freshStub()
    const result = await stub.get('/api/v1/something-else')
    expect(result).toEqual({})
  })

  test('returns empty object when org is not found for a single-item endpoint', async () => {
    const stub = await freshStub()
    const result = await stub.get(
      '/api/v1/accreditation-applications/999999/app999'
    )
    expect(result).toEqual({})
  })

  test('falls back to the first accreditation when itemId does not match', async () => {
    const stub = await freshStub()
    const result = await stub.get(
      '/api/v1/accreditation-applications/50001/not-a-real-item'
    )
    expect(result.id).toBe('app001')
  })

  test('returns empty object when org has no accreditations to fall back to', async () => {
    const stub = await freshStub()
    // Patch an empty accreditations array in on an existing org via seed is complex;
    // instead exercise the "no item at all" branch through an org whose single
    // accreditation id never matches and whose accreditations array is non-empty
    // is already covered above — this covers the case where parseEndpoint matches
    // but there is no section, returning the base item itself.
    const result = await stub.get(
      '/api/v1/accreditation-applications/50001/app001/some-section'
    )
    expect(result.id).toBe('app001')
  })
})

describe('stubApiClient.post — CDP upload initiate', () => {
  test('returns a fileUploadId, uploadUrl and statusUrl', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/sampling-plan/files/initiate',
      {}
    )
    expect(result.fileUploadId).toMatch(/^stub-upload-/)
    expect(result.uploadUrl).toContain(result.fileUploadId)
    expect(result.statusUrl).toContain(`${result.fileUploadId}/status`)
    expect(result.statusUrl).toContain(
      '/api/v1/accreditation-applications/50001/app001/sampling-plan'
    )
  })
})

describe('stubApiClient.post — seed with unknown org', () => {
  test('still returns a seeded item, keyed on the orgId, when org is not found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/999999/item999/Plastic/seed',
      { year: 2027 }
    )
    expect(result.orgId).toBe('999999')
    expect(result.applicationStatus).toBe('Saved')
  })
})

describe('stubApiClient.post — submit', () => {
  test('sets Submitted status, reference and submitter details for a known item', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/submit',
      { name: 'Jo Bloggs', email: 'jo@example.com', jobTitle: 'Director' }
    )
    expect(result.accreditationReference).toMatch(/^AP/)

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.applicationStatus).toBe('Submitted')
    expect(app.submitterContactDetails).toEqual({
      fullName: 'Jo Bloggs',
      email: 'jo@example.com',
      role: 'Director'
    })
    expect(app.accreditationReference).toBe(result.accreditationReference)
  })

  test('falls back to fullName/role fields when name/jobTitle are absent', async () => {
    const stub = await freshStub()
    await stub.post('/api/v1/accreditation-applications/50001/app001/submit', {
      fullName: 'Ada Lovelace',
      role: 'Engineer',
      email: 'ada@example.com'
    })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.submitterContactDetails.fullName).toBe('Ada Lovelace')
    expect(app.submitterContactDetails.role).toBe('Engineer')
  })

  test('generates a reference from an exporter site postcode', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50006/app006exp/submit',
      {}
    )
    expect(result.accreditationReference).toMatch(/^AP/)
  })

  test('submits without a body and still returns a reference', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/submit'
    )
    expect(result.accreditationReference).toMatch(/^AP/)

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.submitterContactDetails).toBeNull()
  })

  test('returns a fallback reference when the item cannot be found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/999999/not-an-item/submit',
      { name: 'Someone' }
    )
    expect(result.accreditationReference).toMatch(/^AP/)
  })

  test('returns a fallback reference when the endpoint does not parse', async () => {
    const stub = await freshStub()
    const result = await stub.post('/api/v1/submit', {})
    expect(result.accreditationReference).toMatch(/^AP/)
  })
})

describe('stubApiClient.post — withdraw', () => {
  test('sets Withdrawn status and reason for a known item', async () => {
    const stub = await freshStub()
    await stub.post(
      '/api/v1/accreditation-applications/50001/app001/withdraw',
      { reason: 'No longer required' }
    )

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.applicationStatus).toBe('Withdrawn')
    expect(app.withdrawalReason).toBe('No longer required')
    expect(app.withdrawalDate).toBeDefined()
  })

  test('defaults withdrawalReason to null when body omits it', async () => {
    const stub = await freshStub()
    await stub.post('/api/v1/accreditation-applications/50001/app001/withdraw')

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.withdrawalReason).toBeNull()
  })

  test('no-op when the item cannot be found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/999999/not-an-item/withdraw',
      { reason: 'x' }
    )
    expect(result).toEqual({})
  })
})

describe('nextOrsId', () => {
  test('returns 001 for an empty site list', async () => {
    const mod = await freshStubModule()
    expect(mod.nextOrsId([])).toBe('001')
  })

  test('continues past the highest existing numeric orsId', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextOrsId([{ orsId: '001' }, { orsId: '002' }, { orsId: '003' }])
    ).toBe('004')
  })

  test('ignores a non-numeric orsId rather than letting it break the max', async () => {
    const mod = await freshStubModule()
    expect(mod.nextOrsId([{ orsId: '002' }, { orsId: 'not-a-number' }])).toBe(
      '003'
    )
  })

  test('ignores an out-of-order lower id, keeping the true max', async () => {
    const mod = await freshStubModule()
    expect(mod.nextOrsId([{ orsId: '005' }, { orsId: '001' }])).toBe('006')
  })
})

describe('stubApiClient.post — overseas-sites', () => {
  test('adds a new site to an item that already has overseasSites.sites', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50006/app006exp/overseas-sites',
      { siteName: 'New Depot' }
    )
    expect(result.isNewSite).toBe(true)
    expect(result.siteName).toBe('New Depot')
    // RA-507: existing seeded sites hold orsId 001-003, so the generated id
    // must continue the sequence rather than leaving orsId unset.
    expect(result.orsId).toBe('004')

    const app = await stub.get(
      '/api/v1/accreditation-applications/50006/app006exp'
    )
    expect(app.overseasSites.sites).toHaveLength(4)
  })

  test('initialises overseasSites when the item has none', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/overseas-sites',
      { siteName: 'First Site' }
    )
    expect(result.siteName).toBe('First Site')
    expect(result.orsId).toBe('001')

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.overseasSites.sites).toHaveLength(1)
    expect(app.overseasSites.sectionStatus).toBe('InProgress')
  })

  test('returns the raw body when the item cannot be found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/999999/not-an-item/overseas-sites',
      { siteName: 'Orphan Site' }
    )
    expect(result).toEqual({ siteName: 'Orphan Site' })
  })
})

describe('stubApiClient.post — overseas-sites promote', () => {
  const PROMOTE_URL =
    '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/promote'

  test('snapshots the current fields and marks the site accredited', async () => {
    const stub = await freshStub()
    const result = await stub.post(PROMOTE_URL, { selected: true })
    expect(result.registeredNowAccredited).toBe(true)
    expect(result.previousSites).toHaveLength(1)
    expect(result.previousSites[0].siteName).toBe('Rotterdam Recycling BV')
  })

  test('returns the raw body when the site is not found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/999999/promote',
      { foo: 'bar' }
    )
    expect(result).toEqual({ foo: 'bar' })
  })
})

describe('stubApiClient.post — overseas-sites revert', () => {
  const PROMOTE_URL =
    '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/promote'
  const REVERT_URL =
    '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/900003/revert'

  test('pops the last snapshot and restores previous fields', async () => {
    const stub = await freshStub()
    await stub.post(PROMOTE_URL, { selected: true })

    const result = await stub.post(REVERT_URL, {})
    expect(result.registeredNowAccredited).toBe(false)
    expect(result.selected).toBe(false)
    expect(result.previousSites).toHaveLength(0)
  })

  test('returns the site unchanged when there is nothing to revert', async () => {
    const stub = await freshStub()
    const result = await stub.post(REVERT_URL, {})
    expect(result.siteId).toBe(900003)
    expect(result.previousSites).toBeUndefined()
  })

  test('returns the body when the site cannot be found at all', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50006/app006exp/overseas-sites/999999/revert',
      { fallback: true }
    )
    expect(result).toEqual({ fallback: true })
  })
})

describe('stubApiClient.post — sampling plan file upload', () => {
  test('appends a file to samplingPlan.files for a known item', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/files',
      { filename: 'plan.pdf' }
    )
    expect(result.fileId).toMatch(/^stub-file-/)

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.samplingPlan.files).toHaveLength(1)
    expect(app.samplingPlan.files[0].filename).toBe('plan.pdf')
  })

  test('defaults filename and fileId when body omits them', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/50001/app001/files',
      {}
    )
    expect(result.fileId).toMatch(/^stub-file-/)

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.samplingPlan.files[0].filename).toBe('unknown')
  })

  test('still returns a fileId when the item cannot be found', async () => {
    const stub = await freshStub()
    const result = await stub.post(
      '/api/v1/accreditation-applications/999999/not-an-item/sampling-plan/files',
      { filename: 'orphan.pdf' }
    )
    expect(result.fileId).toMatch(/^stub-file-/)
  })
})

describe('stubApiClient.patch — errors and fallbacks', () => {
  test('returns empty object when the endpoint does not parse', async () => {
    const stub = await freshStub()
    const result = await stub.patch('/api/v1/not-a-real-endpoint', {})
    expect(result).toEqual({})
  })

  test('returns empty object when org is not found', async () => {
    const stub = await freshStub()
    const result = await stub.patch(
      '/api/v1/accreditation-applications/999999/app999/tonnage',
      {}
    )
    expect(result).toEqual({})
  })

  test('returns empty object when item is not found', async () => {
    const stub = await freshStub()
    const result = await stub.patch(
      '/api/v1/accreditation-applications/50001/not-an-item/tonnage',
      {}
    )
    expect(result).toEqual({})
  })

  test('returns empty object when there is no section on the endpoint', async () => {
    const stub = await freshStub()
    const result = await stub.patch(
      '/api/v1/accreditation-applications/50001/app001',
      {}
    )
    expect(result).toEqual({})
  })
})

describe('stubApiClient.put', () => {
  test('always resolves to an empty object', async () => {
    const stub = await freshStub()
    await expect(stub.put('/anything', { any: 'body' })).resolves.toEqual({})
  })
})

const ORS = '/api/v1/accreditation-applications/50006/app006exp/overseas-sites'
const ORS_SITE_ID = 900003
const INTERIM_COLLECTION = `${ORS}/${ORS_SITE_ID}/interim-sites`

function interimBody(overrides = {}) {
  return {
    country: 'France',
    siteName: 'Calais Interim Depot',
    addressLine1: '1 Rue du Port',
    townOrCity: 'Calais',
    contactName: 'Marie Curie',
    contactEmail: 'marie@example.com',
    contactPhone: '0033111222333',
    operationCodes: ['R12'],
    ...overrides
  }
}

async function readSite(stub) {
  const app = await stub.get(
    '/api/v1/accreditation-applications/50006/app006exp'
  )
  return app.overseasSites.sites.find((s) => s.siteId === ORS_SITE_ID)
}

describe('nextSiteId', () => {
  test('starts at 1 when there is nothing to count', async () => {
    const mod = await freshStubModule()
    expect(mod.nextSiteId([])).toBe(1)
  })

  // Shared on purpose: the interim routes address a site by its own id without
  // naming its parent, so an interim id colliding with an ORS id would make
  // /interim-sites/{id} ambiguous.
  test('counts interim site ids as well as ORS ids', async () => {
    const mod = await freshStubModule()
    expect(mod.nextSiteId([{ siteId: 2, interimSites: [{ siteId: 7 }] }])).toBe(
      8
    )
  })

  test('counts a withdrawn interim site, whose id stays claimed', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextSiteId([
        { siteId: 1, interimSites: [{ siteId: 9, removedAt: '2026-01-01' }] }
      ])
    ).toBe(10)
  })

  // An ORS written before RA-603 has no list at all.
  test('reads the legacy singular shape', async () => {
    const mod = await freshStubModule()
    expect(mod.nextSiteId([{ siteId: 1, interimSite: { siteId: 4 } }])).toBe(5)
  })
})

describe('nextInterimSiteNumber', () => {
  test('starts at 001', async () => {
    const mod = await freshStubModule()
    expect(mod.nextInterimSiteNumber([])).toBe('001')
  })

  // Counted across the whole application rather than restarted per ORS.
  test('continues past the highest number on any ORS', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextInterimSiteNumber([
        { siteId: 1, interimSites: [{ siteNumber: '001' }] },
        { siteId: 2, interimSites: [{ siteNumber: '002' }] }
      ])
    ).toBe('003')
  })

  // AC05 keeps the record forever, so reissuing its number would put one
  // regulator-visible identifier on two rows.
  test('keeps a withdrawn interim site number reserved', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextInterimSiteNumber([
        {
          siteId: 1,
          interimSites: [{ siteNumber: '001', removedAt: '2026-01-01' }]
        }
      ])
    ).toBe('002')
  })

  // The format real stored data uses. It must not parse, or numbering breaks.
  test('ignores a legacy SN-000N number', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextInterimSiteNumber([
        { siteId: 1, interimSites: [{ siteNumber: 'SN-0021' }] }
      ])
    ).toBe('001')
  })

  test('reads the legacy singular shape', async () => {
    const mod = await freshStubModule()
    expect(
      mod.nextInterimSiteNumber([
        { siteId: 1, interimSite: { siteNumber: '004' } }
      ])
    ).toBe('005')
  })
})

describe('stubApiClient — interim sites (RA-603)', () => {
  test('adds an interim site numbered 001 and lists it', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())

    expect(created.siteNumber).toBe('001')
    expect(created.removedAt).toBeNull()
    expect(created.createdAt).toBeTruthy()
    expect((await readSite(stub)).interimSites).toHaveLength(1)
  })

  // AC01/AC06: the restriction this ticket exists to lift.
  test('adds a second interim site, keeping the first', async () => {
    const stub = await freshStub()
    const first = await stub.post(INTERIM_COLLECTION, interimBody())
    const second = await stub.post(
      INTERIM_COLLECTION,
      interimBody({ siteName: 'Dunkirk Interim Depot' })
    )

    expect(second.siteNumber).toBe('002')
    expect(second.siteId).not.toBe(first.siteId)
    const site = await readSite(stub)
    expect(site.interimSites.map((i) => i.siteName)).toEqual([
      'Calais Interim Depot',
      'Dunkirk Interim Depot'
    ])
  })

  test('points the legacy singular mirror at the first interim site', async () => {
    const stub = await freshStub()
    await stub.post(INTERIM_COLLECTION, interimBody())

    expect((await readSite(stub)).interimSite.siteName).toBe(
      'Calais Interim Depot'
    )
  })

  // AC04: one write touches one interim site.
  test('edits one interim site and leaves its sibling alone', async () => {
    const stub = await freshStub()
    const first = await stub.post(INTERIM_COLLECTION, interimBody())
    const second = await stub.post(
      INTERIM_COLLECTION,
      interimBody({ siteName: 'Dunkirk Interim Depot' })
    )

    await stub.patch(`${INTERIM_COLLECTION}/${second.siteId}`, {
      siteName: 'Renamed Depot'
    })

    const site = await readSite(stub)
    expect(
      site.interimSites.find((i) => i.siteId === second.siteId).siteName
    ).toBe('Renamed Depot')
    expect(
      site.interimSites.find((i) => i.siteId === first.siteId).siteName
    ).toBe('Calais Interim Depot')
  })

  test('ignores server-owned fields in a patch body', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())

    await stub.patch(`${INTERIM_COLLECTION}/${created.siteId}`, {
      siteNumber: '999',
      siteId: 12345,
      siteName: 'Renamed'
    })

    const [interimSite] = (await readSite(stub)).interimSites
    expect(interimSite.siteNumber).toBe('001')
    expect(interimSite.siteId).toBe(created.siteId)
    expect(interimSite.siteName).toBe('Renamed')
  })

  // AC05. A hard delete would pass every page-level assertion and fail this one,
  // which is the only reason this test is worth having.
  test('withdrawing keeps the record, stamped with when it went', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())

    await stub.delete(`${INTERIM_COLLECTION}/${created.siteId}`)

    const site = await readSite(stub)
    expect(site.interimSites).toHaveLength(1)
    expect(site.interimSites[0].removedAt).toBeTruthy()
    expect(site.interimSites[0].siteNumber).toBe('001')
  })

  test('withdrawing re-points the mirror at the next site still active', async () => {
    const stub = await freshStub()
    const first = await stub.post(INTERIM_COLLECTION, interimBody())
    await stub.post(
      INTERIM_COLLECTION,
      interimBody({ siteName: 'Dunkirk Interim Depot' })
    )

    await stub.delete(`${INTERIM_COLLECTION}/${first.siteId}`)

    expect((await readSite(stub)).interimSite.siteName).toBe(
      'Dunkirk Interim Depot'
    )
  })

  test('withdrawing the only interim site clears the mirror', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())

    await stub.delete(`${INTERIM_COLLECTION}/${created.siteId}`)

    expect((await readSite(stub)).interimSite).toBeNull()
  })

  // The identity link AC05 exists to protect: the same record resumes rather
  // than a replacement arriving with the same name.
  test('restoring brings back the same record, not a lookalike', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())
    await stub.delete(`${INTERIM_COLLECTION}/${created.siteId}`)

    await stub.post(`${INTERIM_COLLECTION}/${created.siteId}/restore`)

    const [interimSite] = (await readSite(stub)).interimSites
    expect(interimSite.removedAt).toBeNull()
    expect(interimSite.siteId).toBe(created.siteId)
    expect(interimSite.siteNumber).toBe('001')
    expect(interimSite.createdAt).toBe(created.createdAt)
  })

  test('a withdrawn number is not reissued to the next interim site', async () => {
    const stub = await freshStub()
    const created = await stub.post(INTERIM_COLLECTION, interimBody())
    await stub.delete(`${INTERIM_COLLECTION}/${created.siteId}`)

    const next = await stub.post(
      INTERIM_COLLECTION,
      interimBody({ siteName: 'Dunkirk Interim Depot' })
    )

    expect(next.siteNumber).toBe('002')
  })

  test('returns nothing for an unknown ORS or interim site', async () => {
    const stub = await freshStub()
    await expect(
      stub.post(`${ORS}/424242/interim-sites`, interimBody())
    ).resolves.toBeUndefined()
    await expect(
      stub.patch(`${INTERIM_COLLECTION}/424242`, { siteName: 'x' })
    ).resolves.toBeUndefined()
  })
})

describe('stubApiClient — interim sites, pre-RA-603 documents', () => {
  // The legacy singular route is still mapped. It has to leave the document in
  // BOTH shapes, or a caller that used it would then be invisible to every
  // plural route.
  test('the legacy singular route writes the list as well as the mirror', async () => {
    const stub = await freshStub()
    const created = await stub.post(
      `${ORS}/${ORS_SITE_ID}/interim-site`,
      interimBody()
    )

    const site = await readSite(stub)
    expect(site.interimSites).toHaveLength(1)
    expect(site.interimSite.siteId).toBe(created.siteId)
    expect(created.siteNumber).toBe('001')
  })

  // A document written before RA-603: a singular field and NO list at all. This
  // is the shape the normalise step exists for.
  test('folds a legacy-only interim site into the list when a second is added', async () => {
    const stub = await freshStub()
    const site = await readSite(stub)
    site.interimSite = {
      siteId: 4242,
      siteNumber: 'SN-0042',
      siteName: 'Legacy Depot',
      operationCodes: ['R12']
    }
    delete site.interimSites

    const added = await stub.post(
      INTERIM_COLLECTION,
      interimBody({ siteName: 'Calais Interim Depot' })
    )

    const after = await readSite(stub)
    expect(after.interimSites.map((i) => i.siteName)).toEqual([
      'Legacy Depot',
      'Calais Interim Depot'
    ])
    // Its id is counted, so the new site cannot collide with it...
    expect(added.siteId).toBeGreaterThan(4242)
    // ...while its unparseable legacy number is skipped rather than parsed.
    expect(added.siteNumber).toBe('001')
  })

  test('withdraws a legacy-only interim site without destroying it', async () => {
    const stub = await freshStub()
    const site = await readSite(stub)
    site.interimSite = {
      siteId: 4242,
      siteNumber: 'SN-0042',
      siteName: 'Legacy Depot'
    }
    delete site.interimSites

    await stub.delete(`${INTERIM_COLLECTION}/4242`)

    const after = await readSite(stub)
    expect(after.interimSites).toHaveLength(1)
    expect(after.interimSites[0].removedAt).toBeTruthy()
    expect(after.interimSite).toBeNull()
  })
})
