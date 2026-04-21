import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
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
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
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
        companyName: 'GLASSROOM EXPORT UK LTD',
        companiesHouseNumber: '07620513',
        schemeRegistrationId: 'SR-001',
        registeredAddress: '123 Business Street',
        approvedPerson: 'John Smith',
        directors: [{ name: 'John Smith' }],
        created: new Date()
      },
      {
        companyName: 'METAL RECYCLING LIMITED',
        companiesHouseNumber: '03323288',
        schemeRegistrationId: 'SR-002',
        registeredAddress: '456 Industrial Road',
        approvedPerson: 'Jane Doe',
        directors: [{ name: 'Jane Doe' }],
        created: new Date()
      }
    ]

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockOrganisations)

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation-list',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    console.log('Result:', result.substring(0, 2000)) // Log first 2000 chars

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('GLASSROOM EXPORT UK LTD'))
  })

  test('Should see Cymraeg organisation list', async () => {
    const mockOrganisations = [
      {
        companyName: 'GLASSROOM EXPORT UK LTD',
        companiesHouseNumber: '07620513',
        schemeRegistrationId: 'SR-001',
        registeredAddress: '123 Business Street',
        approvedPerson: 'John Smith',
        directors: [{ name: 'John Smith' }],
        created: new Date()
      },
      {
        companyName: 'METAL RECYCLING LIMITED',
        companiesHouseNumber: '03323288',
        schemeRegistrationId: 'SR-002',
        registeredAddress: '456 Industrial Road',
        approvedPerson: 'Jane Doe',
        directors: [{ name: 'Jane Doe' }],
        created: new Date()
      }
    ]

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockOrganisations)

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/organisation-list',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
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
