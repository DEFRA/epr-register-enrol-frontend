import { createServer } from './server.js'
import { statusCodes } from './common/constants/status-codes.js'

// /about was removed entirely (unlinked example/scaffold page — only ever
// reachable via the site-wide nav's own "About" link, which pointed nowhere
// else and served no product purpose). Relies on the /{language} catch-all's
// language-segment 404 (route-params-guard.js) since /about is a
// single-segment path.
describe('#about (removed)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each(['/about', '/cy/about'])('GET %s 404s', async (url) => {
    const { statusCode } = await server.inject({ method: 'GET', url })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
