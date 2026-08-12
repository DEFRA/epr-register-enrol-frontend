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

  test('still returns a created interim site when siteId is not found', async () => {
    const result = await stub.post(
      '/api/v1/accreditation-applications/50004/app004exp/overseas-sites/999999/interim-site',
      { country: 'Spain' }
    )
    expect(result.country).toBe('Spain')
    expect(result.isNewSite).toBe(true)
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
    await stub.patch(PATCH_URL, { plannedTonnageBand: 'UpTo1000' })

    const app = await stub.get(
      '/api/v1/accreditation-applications/50001/app001'
    )
    expect(app.prnIssuance.plannedIssuance).toBe('UpTo1000')
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
