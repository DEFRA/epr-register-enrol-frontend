import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

describe('#worklist-itemsController', () => {
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
      url: '/worklist-items',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Worklist Items'))
  })

  test('Should see a worklist item', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/worklist-items',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Glass Recycling Export Import Company')
    )
  })
})
