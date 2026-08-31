import { describe, test, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '../api-client.js'
import { accreditationApiService } from './accreditationApiService.js'

vi.mock('../api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

const ORG_ID = 'org-123'
const APP_ID = 'app-456'
const BASE = `/api/v1/accreditation-applications`

beforeEach(() => {
  vi.clearAllMocks()
})

describe('accreditationApiService', () => {
  describe('seedApplication', () => {
    const SITE_ID = 'site-abc'
    const MATERIAL = 'Steel'
    const YEAR = 2026

    test('calls POST to seed endpoint with siteId and materialType in URL', async () => {
      apiClient.post.mockResolvedValue({ ApplicationId: APP_ID })
      const result = await accreditationApiService.seedApplication(
        ORG_ID,
        SITE_ID,
        MATERIAL,
        YEAR
      )
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${SITE_ID}/${MATERIAL}/seed`,
        { year: YEAR }
      )
      expect(result.ApplicationId).toBe(APP_ID)
    })

    test('normalises 4xx error with status', async () => {
      const err = Object.assign(new Error('Bad Request'), { status: 400 })
      apiClient.post.mockRejectedValue(err)
      await expect(
        accreditationApiService.seedApplication(ORG_ID, SITE_ID, MATERIAL, YEAR)
      ).rejects.toMatchObject({ status: 400, isApiError: true })
    })

    test('normalises 5xx error with status', async () => {
      const err = Object.assign(new Error('Server Error'), { status: 500 })
      apiClient.post.mockRejectedValue(err)
      await expect(
        accreditationApiService.seedApplication(ORG_ID, SITE_ID, MATERIAL, YEAR)
      ).rejects.toMatchObject({ status: 500, isApiError: true })
    })

    test('normalises network failure without status', async () => {
      apiClient.post.mockRejectedValue(new Error('fetch failed'))
      await expect(
        accreditationApiService.seedApplication(ORG_ID, SITE_ID, MATERIAL, YEAR)
      ).rejects.toMatchObject({ status: 500, isApiError: true })
    })

    test('normalises an error with no message to "Unknown error"', async () => {
      apiClient.post.mockRejectedValue({ status: 400 })
      await expect(
        accreditationApiService.seedApplication(ORG_ID, SITE_ID, MATERIAL, YEAR)
      ).rejects.toMatchObject({ message: 'Unknown error', status: 400 })
    })
  })

  describe('listApplications', () => {
    test('calls GET for org list', async () => {
      apiClient.get.mockResolvedValue([])
      await accreditationApiService.listApplications(ORG_ID)
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${ORG_ID}`)
    })
  })

  describe('getApplication', () => {
    test('calls GET for single application', async () => {
      apiClient.get.mockResolvedValue({ ApplicationId: APP_ID })
      await accreditationApiService.getApplication(ORG_ID, APP_ID)
      expect(apiClient.get).toHaveBeenCalledWith(`${BASE}/${ORG_ID}/${APP_ID}`)
    })

    test('propagates 404 as normalised error', async () => {
      const err = Object.assign(new Error('Not Found'), { status: 404 })
      apiClient.get.mockRejectedValue(err)
      await expect(
        accreditationApiService.getApplication(ORG_ID, 'missing')
      ).rejects.toMatchObject({ status: 404, isApiError: true })
    })

    test('accreditationReference comes from applicationReference on real backend responses', async () => {
      apiClient.get.mockResolvedValue({
        applicationReference: 'APP2027ER5000390GL'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.accreditationReference).toBe('APP2027ER5000390GL')
    })

    test('accreditationReference falls back to legacy/stub accreditationReference field', async () => {
      apiClient.get.mockResolvedValue({
        accreditationReference: 'RA-000000001'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.accreditationReference).toBe('RA-000000001')
    })

    test('accreditationReference is null when neither field is present', async () => {
      apiClient.get.mockResolvedValue({})
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.accreditationReference).toBeNull()
    })

    // RA-519: organisationId is ReEx's internal ObjectId, used to build
    // resubmit/redirect URLs (landingUrl) - never safe to substitute the
    // numeric orgId for it. orgId is the operator/regulator-safe numeric
    // organisation number, surfaced separately as organisationNumber for the
    // bank payment reference.
    test('organisationId comes from the raw organisationId, not orgId', async () => {
      apiClient.get.mockResolvedValue({
        orgId: 500500,
        organisationId: '6a74a6a12b7c39b0cc15ca55'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.organisationId).toBe('6a74a6a12b7c39b0cc15ca55')
    })

    test('organisationId is undefined when the backend omits it', async () => {
      apiClient.get.mockResolvedValue({
        orgId: 500500
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.organisationId).toBeUndefined()
    })

    test('organisationNumber comes from orgId', async () => {
      apiClient.get.mockResolvedValue({
        orgId: 500500,
        organisationId: '6a74a6a12b7c39b0cc15ca55'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.organisationNumber).toBe(500500)
    })

    test('organisationNumber is null when orgId is absent', async () => {
      apiClient.get.mockResolvedValue({
        organisationId: '6a74a6a12b7c39b0cc15ca55'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.organisationNumber).toBeNull()
    })

    test('sitePostcode is extracted from an object-shaped siteAddress', async () => {
      apiClient.get.mockResolvedValue({
        siteAddress: { line1: 'UNIT 5', town: 'Bolton', postcode: 'BL4 7AQ' }
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBe('BL4 7AQ')
      expect(result.siteAddress).toBe('UNIT 5, Bolton, BL4 7AQ')
    })

    test('sitePostcode is extracted from a plain-string siteAddress', async () => {
      apiClient.get.mockResolvedValue({
        siteAddress: 'North Road, Siteville, SI1 1AA'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBe('SI1 1AA')
      expect(result.siteAddress).toBe('North Road, Siteville, SI1 1AA')
    })

    test('sitePostcode is extracted from a plain-string Scottish siteAddress', async () => {
      apiClient.get.mockResolvedValue({
        siteAddress: '12 Harbour Road, Aberdeen, AB11 5DQ'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBe('AB11 5DQ')
    })

    test('sitePostcode is null when a plain-string siteAddress has no recognisable postcode', async () => {
      apiClient.get.mockResolvedValue({
        siteAddress: 'North Road, Siteville'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBeNull()
    })

    test('sitePostcode is null when siteAddress is absent', async () => {
      apiClient.get.mockResolvedValue({})
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBeNull()
    })

    test('sitePostcode falls back to companyRegisterAddressPostcode when siteAddress is absent (exporter case)', async () => {
      apiClient.get.mockResolvedValue({
        companyRegisterAddressPostcode: 'KW2 7LZ'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBe('KW2 7LZ')
    })

    test('sitePostcode prefers siteAddress.postcode over companyRegisterAddressPostcode when both present (reprocessor regression guard)', async () => {
      apiClient.get.mockResolvedValue({
        siteAddress: { line1: 'UNIT 5', town: 'Bolton', postcode: 'BL4 7AQ' },
        companyRegisterAddressPostcode: 'KW2 7LZ'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.sitePostcode).toBe('BL4 7AQ')
    })

    test('companyRegisteredAddress is formatted from an object shape', async () => {
      apiClient.get.mockResolvedValue({
        companyRegisteredAddress: {
          line1: '4 Glassworks Court',
          town: 'Bristol',
          postcode: 'BS1 4AA'
        }
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.companyRegisteredAddress).toBe(
        '4 Glassworks Court, Bristol, BS1 4AA'
      )
    })

    test('companyRegisteredAddress is passed through when it is a plain string', async () => {
      apiClient.get.mockResolvedValue({
        companyRegisteredAddress: '4 Glassworks Court, Bristol, BS1 4AA'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.companyRegisteredAddress).toBe(
        '4 Glassworks Court, Bristol, BS1 4AA'
      )
    })

    test('companyRegisteredAddress is null when absent', async () => {
      apiClient.get.mockResolvedValue({})
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.companyRegisteredAddress).toBeNull()
    })

    test('dueDate is passed through when it is a valid ISO string', async () => {
      apiClient.get.mockResolvedValue({
        dueDate: '2026-09-30T00:00:00.000Z'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.dueDate).toBe('2026-09-30T00:00:00.000Z')
    })

    test('dueDate is null when absent', async () => {
      apiClient.get.mockResolvedValue({})
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.dueDate).toBeNull()
    })

    // Regression: an unparseable dueDate must not crash the landing page —
    // formatDate() throws on an Invalid Date, so anything the backend sends
    // that isn't a valid ISO string is dropped to null here instead.
    test('dueDate falls back to null when the backend sends a malformed value', async () => {
      apiClient.get.mockResolvedValue({
        dueDate: 'not-a-real-date'
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.dueDate).toBeNull()
    })

    test('dueDate falls back to null for a non-string value', async () => {
      apiClient.get.mockResolvedValue({
        dueDate: 12345
      })
      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )
      expect(result.dueDate).toBeNull()
    })
  })

  describe('patchTonnage', () => {
    test('calls PATCH tonnage endpoint', async () => {
      apiClient.patch.mockResolvedValue({ ApplicationId: APP_ID })
      const body = { PlannedTonnageBand: 'UpTo500' }
      await accreditationApiService.patchTonnage(ORG_ID, APP_ID, body)
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/tonnage`,
        body
      )
    })

    // RA-292 AC03: `isNew` is derived server-side, so the client must relay the
    // authoriser objects verbatim rather than projecting known fields.
    test('sends the authoriser objects through untouched, including isNew', async () => {
      apiClient.patch.mockResolvedValue({})
      const body = {
        authorisers: [
          { fullName: 'Jane', email: 'jane@example.com', isNew: true },
          { fullName: 'Bob', email: 'bob@example.com', isNew: false },
          { fullName: 'Sue', email: 'sue@example.com' }
        ]
      }
      await accreditationApiService.patchTonnage(ORG_ID, APP_ID, body)
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/tonnage`,
        body
      )
    })
  })

  describe('normalisation of prns authorisers (RA-292)', () => {
    test('preserves isNew when the backend returns prnIssuance.signatories', async () => {
      apiClient.get.mockResolvedValue({
        id: APP_ID,
        prnIssuance: {
          sectionStatus: 'InProgress',
          plannedIssuance: 'UpTo5000',
          signatories: [
            { fullName: 'Jane', email: 'jane@example.com', isNew: true },
            { fullName: 'Bob', email: 'bob@example.com', isNew: false },
            { fullName: 'Sue', email: 'sue@example.com' },
            { fullName: 'Ann', email: 'ann@example.com', isNew: null }
          ]
        }
      })

      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )

      expect(result.prns.authorisers).toEqual([
        { fullName: 'Jane', email: 'jane@example.com', isNew: true },
        { fullName: 'Bob', email: 'bob@example.com', isNew: false },
        { fullName: 'Sue', email: 'sue@example.com' },
        { fullName: 'Ann', email: 'ann@example.com', isNew: null }
      ])
      expect(result.prns.authorisers[2]).not.toHaveProperty('isNew')
    })

    test('preserves isNew when the payload already uses the prns shape', async () => {
      apiClient.get.mockResolvedValue({
        id: APP_ID,
        prns: {
          sectionStatus: 'InProgress',
          plannedTonnageBand: 'UpTo5000',
          authorisers: [
            { fullName: 'Jane', email: 'jane@example.com', isNew: true }
          ]
        }
      })

      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )

      expect(result.prns.authorisers[0].isNew).toBe(true)
    })

    test('yields an empty authoriser list when signatories are missing', async () => {
      apiClient.get.mockResolvedValue({
        id: APP_ID,
        prnIssuance: { sectionStatus: 'NotStarted' }
      })

      const result = await accreditationApiService.getApplication(
        ORG_ID,
        APP_ID
      )

      expect(result.prns.authorisers).toEqual([])
    })
  })

  describe('seedExporterApplication', () => {
    test('calls POST to exporter seed endpoint without siteId', async () => {
      apiClient.post.mockResolvedValue({ ApplicationId: APP_ID })
      await accreditationApiService.seedExporterApplication(
        ORG_ID,
        'Steel',
        2027
      )
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/Steel/seed`,
        { year: 2027 }
      )
    })
  })

  describe('patchOverseasSites', () => {
    test('calls PATCH overseas-sites endpoint', async () => {
      apiClient.patch.mockResolvedValue({})
      const body = { SectionStatus: 'Completed' }
      await accreditationApiService.patchOverseasSites(ORG_ID, APP_ID, body)
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites`,
        body
      )
    })
  })

  describe('updateOverseasSite', () => {
    test('calls PATCH to the site-specific overseas-sites endpoint', async () => {
      apiClient.patch.mockResolvedValue({ siteId: 900002 })
      const body = { siteName: 'Updated Site Name' }
      const result = await accreditationApiService.updateOverseasSite(
        ORG_ID,
        APP_ID,
        900002,
        body
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites/900002`,
        body
      )
      expect(result).toEqual({ siteId: 900002 })
    })

    test('normalises API error', async () => {
      const err = Object.assign(new Error('Conflict'), { status: 409 })
      apiClient.patch.mockRejectedValue(err)
      await expect(
        accreditationApiService.updateOverseasSite(ORG_ID, APP_ID, 900002, {})
      ).rejects.toMatchObject({ status: 409, isApiError: true })
    })
  })

  describe('addBesEvidenceFile', () => {
    test('calls POST to BES evidence files endpoint for a site', async () => {
      apiClient.post.mockResolvedValue({ FileId: 'bes-file-1' })
      const body = {
        Filename: 'evidence.pdf',
        BESEvidenceValidFromDate: '2026-01-01T00:00:00Z'
      }
      await accreditationApiService.addBesEvidenceFile(
        ORG_ID,
        APP_ID,
        900001,
        body
      )
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites/900001/bes-evidence/files`,
        body
      )
    })
  })

  describe('patchBesEvidence', () => {
    test('calls PATCH BES evidence endpoint for a site', async () => {
      apiClient.patch.mockResolvedValue({})
      const body = { DoYouWantToUploadMoreEvidence: false }
      await accreditationApiService.patchBesEvidence(
        ORG_ID,
        APP_ID,
        900001,
        body
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites/900001/bes-evidence`,
        body
      )
    })
  })

  describe('deleteBesEvidenceFile', () => {
    test('calls DELETE BES evidence file endpoint', async () => {
      apiClient.delete.mockResolvedValue(undefined)
      await accreditationApiService.deleteBesEvidenceFile(
        ORG_ID,
        APP_ID,
        900001,
        'bes-file-1'
      )
      expect(apiClient.delete).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites/900001/bes-evidence/files/bes-file-1`
      )
    })
  })

  describe('patchBesEvidenceSection', () => {
    test('calls PATCH bes-evidence endpoint for section status', async () => {
      apiClient.patch.mockResolvedValue({})
      const body = { SectionStatus: 'Completed' }
      await accreditationApiService.patchBesEvidenceSection(
        ORG_ID,
        APP_ID,
        body
      )
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/bes-evidence`,
        body
      )
    })
  })

  describe('patchBusinessPlan', () => {
    test('calls PATCH business-plan endpoint', async () => {
      apiClient.patch.mockResolvedValue({ ApplicationId: APP_ID })
      const body = { NewInfrastructurePercent: 50 }
      await accreditationApiService.patchBusinessPlan(ORG_ID, APP_ID, body)
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/business-plan`,
        body
      )
    })
  })

  describe('patchSamplingPlan', () => {
    test('calls PATCH sampling-plan endpoint', async () => {
      apiClient.patch.mockResolvedValue({ ApplicationId: APP_ID })
      await accreditationApiService.patchSamplingPlan(ORG_ID, APP_ID, {})
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/sampling-plan`,
        {}
      )
    })
  })

  describe('submitApplication', () => {
    test('calls POST submit endpoint', async () => {
      apiClient.post.mockResolvedValue({ ApplicationId: APP_ID })
      const body = { FullName: 'Jane', JobTitle: 'Manager', Email: 'j@e.com' }
      await accreditationApiService.submitApplication(ORG_ID, APP_ID, body)
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/submit`,
        body,
        undefined
      )
    })

    test('passes through per-call options (e.g. timeout override) to apiClient.post', async () => {
      apiClient.post.mockResolvedValue({ ApplicationId: APP_ID })
      const body = { FullName: 'Jane', JobTitle: 'Manager', Email: 'j@e.com' }
      await accreditationApiService.submitApplication(ORG_ID, APP_ID, body, {
        timeout: 20000
      })
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/submit`,
        body,
        { timeout: 20000 }
      )
    })
  })

  describe('createInterimSite', () => {
    test('calls POST to the nested interim-site endpoint for the given siteId', async () => {
      apiClient.post.mockResolvedValue({ siteId: 123, siteNumber: 'SN-001' })
      const body = { country: 'France', siteName: 'Interim Depot' }
      const result = await accreditationApiService.createInterimSite(
        ORG_ID,
        APP_ID,
        900001,
        body
      )
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/overseas-sites/900001/interim-site`,
        body
      )
      expect(result).toEqual({ siteId: 123, siteNumber: 'SN-001' })
    })

    test('normalises API error', async () => {
      const err = Object.assign(new Error('Conflict'), { status: 409 })
      apiClient.post.mockRejectedValue(err)
      await expect(
        accreditationApiService.createInterimSite(ORG_ID, APP_ID, 900001, {})
      ).rejects.toMatchObject({ status: 409, isApiError: true })
    })
  })

  describe('addFile', () => {
    test('calls POST files endpoint', async () => {
      apiClient.post.mockResolvedValue({ FileId: 'file-1' })
      const body = {
        FileId: 'file-1',
        Filename: 'plan.pdf',
        ContentType: 'application/pdf'
      }
      await accreditationApiService.addFile(ORG_ID, APP_ID, body)
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/files`,
        body
      )
    })
  })

  describe('deleteFile', () => {
    test('calls DELETE files endpoint', async () => {
      apiClient.delete.mockResolvedValue(undefined)
      await accreditationApiService.deleteFile(ORG_ID, APP_ID, 'file-1')
      expect(apiClient.delete).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/files/file-1`
      )
    })

    test('treats a 404 as success — the file is already gone', async () => {
      const notFound = new Error('not found')
      notFound.status = 404
      apiClient.delete.mockRejectedValue(notFound)

      await expect(
        accreditationApiService.deleteFile(ORG_ID, APP_ID, 'file-1')
      ).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledTimes(1)
    })

    test('does not retry a permanent 4xx failure', async () => {
      const conflict = new Error('section not editable')
      conflict.status = 409
      apiClient.delete.mockRejectedValue(conflict)

      await expect(
        accreditationApiService.deleteFile(ORG_ID, APP_ID, 'file-1')
      ).rejects.toThrow('section not editable')
      expect(apiClient.delete).toHaveBeenCalledTimes(1)
    })
  })
})
