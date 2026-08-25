import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'

// RA-485: /operator-details and /operator-registration were redundant,
// never-built stub pages — removed entirely (no route registered at all),
// relying on the /{language} catch-all's language-segment guard (RA-485 fix
// in route-params-guard.js) to 404 the bare paths rather than 400 them.
describe('#operator-details and #operator-registration (RA-485: removed)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each([
    '/operator-details',
    '/cy/operator-details',
    '/operator-registration',
    '/cy/operator-registration'
  ])('GET %s 404s', async (url) => {
    const { statusCode } = await server.inject({ method: 'GET', url })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
