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
        body
      )
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
  })
})
