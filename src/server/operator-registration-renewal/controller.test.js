import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#operatorRegistrationRenewalController', () => {
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
      url: '/en/operator-registration-renewal'
    })

    expect(result).toEqual(expect.stringContaining('Renew Your Registration'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-registration-renewal'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('[Welsh] Renew Your Registration')
    )
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-registration-renewal'
    })

    expect(result).toEqual(expect.stringContaining('Registration'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
