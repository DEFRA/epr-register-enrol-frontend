import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#organisationListController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should see organisation list', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/organisation-list'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('GLASSROOM EXPORT UK LTD'))
  })

  test('Should see Cymraeg organisation list', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/organisation-list'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('GLASSROOM EXPORT UK LTD'))
  })
})
