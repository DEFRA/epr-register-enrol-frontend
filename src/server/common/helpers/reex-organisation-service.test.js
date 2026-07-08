import { describe, test, expect, beforeEach, vi } from 'vitest'

import { apiClient } from '../api-client.js'
import {
  getLinkedDefraOrganisationId,
  _clearReExOrgCache
} from './reex-organisation-service.js'

vi.mock('../api-client.js', () => ({
  apiClient: { get: vi.fn() }
}))

beforeEach(() => {
  _clearReExOrgCache()
  vi.clearAllMocks()
})

describe('getLinkedDefraOrganisationId', () => {
  test('calls the defra-link endpoint and returns the linked id', async () => {
    apiClient.get.mockResolvedValue({
      organisationId: '50002',
      linkedDefraOrganisationId: 907001
    })

    const id = await getLinkedDefraOrganisationId('50002')

    expect(id).toBe(907001)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/organisations/50002/defra-link'
    )
  })

  test('returns null when ReEx recorded no link', async () => {
    apiClient.get.mockResolvedValue({
      organisationId: '50002',
      linkedDefraOrganisationId: null
    })

    expect(await getLinkedDefraOrganisationId('50002')).toBeNull()
  })

  test('returns null for a null organisation id without calling the API', async () => {
    expect(await getLinkedDefraOrganisationId(null)).toBeNull()
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  test('caches the result — a second call within TTL does not re-hit the API', async () => {
    apiClient.get.mockResolvedValue({ linkedDefraOrganisationId: 907001 })

    await getLinkedDefraOrganisationId('50002')
    await getLinkedDefraOrganisationId('50002')

    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  test('re-fetches once the cached entry has expired', async () => {
    apiClient.get.mockResolvedValue({ linkedDefraOrganisationId: 907001 })

    // Config default TTL is 3600000ms. First call at t=0, second past expiry.
    await getLinkedDefraOrganisationId('50002', { now: () => 0 })
    await getLinkedDefraOrganisationId('50002', { now: () => 3_600_001 })

    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  test('does not cache a failed lookup', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('ReEx down'))
    await expect(getLinkedDefraOrganisationId('50002')).rejects.toThrow(
      'ReEx down'
    )

    apiClient.get.mockResolvedValue({ linkedDefraOrganisationId: 907001 })
    expect(await getLinkedDefraOrganisationId('50002')).toBe(907001)
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })
})
