import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

describe('#cookiesController', () => {
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

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cookies',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(expect.stringContaining('Cookies |'))
    expect(result).toContain('crumb')
    expect(result).toContain('session')
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh locale', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/cookies',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(statusCode).toBe(statusCodes.ok)
  })
})
