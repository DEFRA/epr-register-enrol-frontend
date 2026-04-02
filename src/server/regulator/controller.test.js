import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#regulatorController', () => {
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
      url: '/en/regulator'
    })

    expect(result).toEqual(expect.stringContaining('Regulator |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

/*   test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/regulator'
    })

    expect(result).toEqual(expect.stringContaining('Rheolwr |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
 */

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/regulator'
    })

    expect(result).toEqual(expect.stringContaining('Regulator |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
