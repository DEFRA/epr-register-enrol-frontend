import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

describe('#contactController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/contact'
    })

    expect(result).toEqual(expect.stringContaining('Contact |'))
    expect(result).toContain('packaging@environment-agency.gov.uk')
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh locale', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/contact'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })
})
