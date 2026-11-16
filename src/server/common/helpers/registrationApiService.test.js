import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiClient } from '../api-client.js'
import { getRegistrationStatusByNumber } from './registrationApiService.js'

vi.mock('../api-client.js', () => ({
  apiClient: { get: vi.fn() }
}))

const REG_NUMBER = 'R27EX0500180001PL'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRegistrationStatusByNumber', () => {
  test('asks for the registration on behalf of the organisation', async () => {
    apiClient.get.mockResolvedValue({ status: 'Approved' })

    await expect(
      getRegistrationStatusByNumber(REG_NUMBER, 50018)
    ).resolves.toEqual({
      status: 'Approved'
    })
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/registrations/by-number/${REG_NUMBER}/status?organisationId=50018`
    )
  })

  test.each([undefined, null, ''])(
    'rejects without calling the backend for organisationId %j',
    async (organisationId) => {
      await expect(
        getRegistrationStatusByNumber(REG_NUMBER, organisationId)
      ).rejects.toThrow('organisationId is required')
      expect(apiClient.get).not.toHaveBeenCalled()
    }
  )
})
