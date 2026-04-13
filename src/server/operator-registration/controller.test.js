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
      url: '/en/operator-registration'
    })

    expect(result).toEqual(
      expect.stringContaining('Operator Registration Page.')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-registration'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        '[Welsh] This page is the Operator Registration Page.'
      )
    )
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-registration'
    })

    expect(result).toEqual(expect.stringContaining('Operator'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
