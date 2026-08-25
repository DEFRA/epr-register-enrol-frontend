import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'

// /operator-organisation-details was a redundant, never-built stub page
// (hardcoded fake data, zero inbound links anywhere in the app) — removed
// entirely, relying on the /{language} catch-all's language-segment guard
// (route-params-guard.js) to 404 the bare path rather than 400 it.
describe('#operator-organisation-details (removed)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each([
    '/operator-organisation-details/123',
    '/cy/operator-organisation-details/123'
  ])('GET %s 404s', async (url) => {
    const { statusCode } = await server.inject({ method: 'GET', url })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
