import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#homeController', () => {
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
      url: '/en'
    })

    expect(result).toEqual(expect.stringContaining('Home |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  /* test('Should provide expected response in Welsh', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/cy'
    })

    expect(result).toEqual(expect.stringContaining('Cartref |'))
    expect(statusCode).toBe(statusCodes.ok)
  }) */

  test('Should provide expected response for default locale', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Home |'))
  })

  // RA-537: the regulator placeholder page was removed. Its paths now fall
  // through to the `/{language}` catch-all, where route-params-guard rejects
  // the invalid language segment with a 404 (not a 400 or a login redirect).
  test.each(['/regulator', '/en/regulator', '/cy/regulator'])(
    '%s returns the not-found page',
    async (url) => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url
      })

      expect(statusCode).toBe(statusCodes.notFound)
      expect(result).toContain('Page not found')
    }
  )
})
