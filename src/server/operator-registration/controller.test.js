import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#operatorRegistrationController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response in English', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/en/operator-registration',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(expect.stringContaining('Operator Registration'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-registration',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        '[Welsh] You must register with your regulator if you either:'
      )
    )
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-registration',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(expect.stringContaining('Annual fee:'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
