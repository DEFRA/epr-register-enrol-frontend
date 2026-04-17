import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#operatorController', () => {
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
      url: '/en/operator',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(expect.stringContaining('Operator Landing Page'))
    expect(result).toEqual(expect.stringContaining('Operator accreditation'))
    expect(result).toEqual(expect.stringContaining('Operator details'))
    expect(result).toEqual(expect.stringContaining('Operator registration'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(
      expect.stringContaining('[Welsh] Operator Landing Page')
    )
    expect(result).toEqual(
      expect.stringContaining('[Welsh] Operator accreditation')
    )
    expect(result).toEqual(expect.stringContaining('[Welsh] Operator details'))
    expect(result).toEqual(
      expect.stringContaining('[Welsh] Operator registration')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/operator',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(result).toEqual(expect.stringContaining('Operator'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
