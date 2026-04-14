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
      expect.stringContaining('How to apply for accreditation')
    )
  })

  test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-accreditation'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('[Welsh] How to apply for accreditation')
    )
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator-accreditation'
    })

    expect(result).toEqual(
      expect.stringContaining('Before you apply for accreditation')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })
})
