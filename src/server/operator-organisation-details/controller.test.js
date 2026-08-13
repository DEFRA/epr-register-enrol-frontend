import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('##operatorOrganisationDetailsController', () => {
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
      url: '/operator-organisation-details/123'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Operator Export Company'))
    expect(result).toEqual(expect.stringContaining('Companies house number'))
    expect(result).toEqual(expect.stringContaining('123'))
  })

  test('Should see Cymraeg organisation details', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/operator-organisation-details/123'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Operator Export Company'))
    expect(result).toEqual(
      expect.stringContaining('[Welsh] Companies house number')
    )
    expect(result).toEqual(expect.stringContaining('123'))
  })
})
