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

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/regulator'
    })

    expect(result).toEqual(expect.stringContaining('Regulator'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
