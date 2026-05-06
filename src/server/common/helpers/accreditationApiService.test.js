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
    test('calls POST to seed endpoint with body', async () => {
      const body = { MaterialType: 'Steel', Year: 2026 }
      apiClient.post.mockResolvedValue({ ApplicationId: APP_ID })
      const result = await accreditationApiService.seedApplication(ORG_ID, body)
      expect(apiClient.post).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/seed`,
        body
      )
      expect(result.ApplicationId).toBe(APP_ID)
    })

    test('normalises 4xx error with status', async () => {
      const err = Object.assign(new Error('Bad Request'), { status: 400 })
      apiClient.post.mockRejectedValue(err)
      await expect(
        accreditationApiService.seedApplication(ORG_ID, {})
      ).rejects.toMatchObject({ status: 400, isApiError: true })
    })

    test('normalises 5xx error with status', async () => {
      const err = Object.assign(new Error('Server Error'), { status: 500 })
      apiClient.post.mockRejectedValue(err)
      await expect(
        accreditationApiService.seedApplication(ORG_ID, {})
      ).rejects.toMatchObject({ status: 500, isApiError: true })
    })

    test('normalises network failure without status', async () => {
      apiClient.post.mockRejectedValue(new Error('fetch failed'))
      await expect(
        accreditationApiService.seedApplication(ORG_ID, {})
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
  })

  describe('patchPrns', () => {
    test('calls PATCH prns endpoint', async () => {
      apiClient.patch.mockResolvedValue({ ApplicationId: APP_ID })
      const body = { PlannedTonnageBand: 'UpTo500' }
      await accreditationApiService.patchPrns(ORG_ID, APP_ID, body)
      expect(apiClient.patch).toHaveBeenCalledWith(
        `${BASE}/${ORG_ID}/${APP_ID}/prns`,
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
