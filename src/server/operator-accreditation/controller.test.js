import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#operatorAccreditationController', () => {
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
      url: '/en/operator-accreditation'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Operator Accreditation Page.')
    )
  })

  test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-accreditation'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        '[Welsh] This page is the Operator Accreditation Page.'
      )
    )
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation'
    })

    expect(result).toEqual(expect.stringContaining('Operator Accreditation'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
