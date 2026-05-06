import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { apiClient } from '../common/api-client.js'
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'

describe('#organisationListController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  test('Should see organisation list', async () => {
    const mockOrganisations = [
      {
        orgId: 1,
        businessType: 'unincorporated',
        companyDetails: {
          name: 'GLASSROOM EXPORT UK LTD',
          registrationNumber: '07620513'
        },
        contactDetails: {
          fullName: 'John Smith',
          email: 'john.smith@glassroom.co.uk'
        }
      },
      {
        orgId: 2,
        businessType: 'partnership',
        companyDetails: {
          name: 'METAL RECYCLING LIMITED',
          registrationNumber: '03323288'
        },
        contactDetails: {
          fullName: 'Jane Doe',
          email: 'jane.doe@metalrecycling.co.uk'
        }
      }
    ]

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockOrganisations)

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation-list'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('GLASSROOM EXPORT UK LTD'))
  })

  test('Should see Cymraeg organisation list', async () => {
    const mockOrganisations = [
      {
        orgId: 1,
        businessType: 'unincorporated',
        companyDetails: {
          name: 'GLASSROOM EXPORT UK LTD',
          registrationNumber: '07620513'
        },
        contactDetails: {
          fullName: 'John Smith',
          email: 'john.smith@glassroom.co.uk'
        }
      },
      {
        orgId: 2,
        businessType: 'partnership',
        companyDetails: {
          name: 'METAL RECYCLING LIMITED',
          registrationNumber: '03323288'
        },
        contactDetails: {
          fullName: 'Jane Doe',
          email: 'jane.doe@metalrecycling.co.uk'
        }
      }
    ]

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockOrganisations)

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/organisation-list'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('GLASSROOM EXPORT UK LTD'))
  })

  test('Should handle API error gracefully', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(
      new Error('API request failed')
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation-list'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })
})
