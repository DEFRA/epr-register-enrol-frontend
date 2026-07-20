import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

describe('#homeController', () => {
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

  test('Should provide expected response in English', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/en',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        'x-test-user-type': 'operator'
      }
    })

    expect(result).toEqual(expect.stringContaining('Home |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  /* test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy'
    })

    expect(result).toEqual(expect.stringContaining('Cartref |'))
    expect(statusCode).toBe(statusCodes.ok)
  }) */

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        'x-test-user-type': 'operator'
      }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Home |'))
  })

  test('Should redirect a regulator to the regulator landing page', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        'x-test-user-type': 'regulator'
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/regulator')
  })

  test('Should redirect a regulator to the language-prefixed regulator landing page', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: '/en',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        'x-test-user-type': 'regulator'
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/en/regulator')
  })
})
