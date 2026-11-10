import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiClient } from '../api-client.js'
import { getRegistrationStatus } from './registrationApiService.js'

vi.mock('../api-client.js', () => ({
  apiClient: { get: vi.fn() }
}))

const REG_ID = 'aaa000000000000000050018'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRegistrationStatus', () => {
  test('asks for the registration on behalf of the organisation', async () => {
    apiClient.get.mockResolvedValue({ status: 'Approved' })

    await expect(getRegistrationStatus(REG_ID, 50018)).resolves.toEqual({
      status: 'Approved'
    })
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/registrations/${REG_ID}/status?organisationId=50018`
    )
  })

  test.each([undefined, null, ''])(
    'rejects without calling the backend for organisationId %j',
    async (organisationId) => {
      await expect(
        getRegistrationStatus(REG_ID, organisationId)
      ).rejects.toThrow('organisationId is required')
      expect(apiClient.get).not.toHaveBeenCalled()
    }
  )
})
