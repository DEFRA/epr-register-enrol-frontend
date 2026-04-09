import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#organisationDetailsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should see organisation details', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation-details/123'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Bananaman Export Company'))
    expect(result).toEqual(expect.stringContaining('Companies house number'))
    expect(result).toEqual(expect.stringContaining('123'))
  })

  test('Should see Cymraeg organisation details', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/organisation-details/123'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Bananaman Export Company'))
    expect(result).toEqual(expect.stringContaining('Rhif Tŷ’r Cwmnïau'))
    expect(result).toEqual(expect.stringContaining('123'))
  })
})
