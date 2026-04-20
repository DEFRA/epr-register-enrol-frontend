import { vi } from 'vitest'

import { config } from '../../../config/config.js'
import { startServer } from './start-server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#serveStaticFiles', () => {
  let server

  beforeAll(() => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
  })

  describe('When secure context is disabled', () => {
    beforeEach(async () => {
      server = await startServer()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should serve favicon as expected', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/favicon.ico',
        headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
      })

      expect(statusCode).toBe(statusCodes.noContent)
    })

    test('Should serve assets as expected', async () => {
      // Note 'npm run build' runs in the postinstall hook in package.json to make sure there is always a file
      // available for this test. Remove as you see fit
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/public/assets/images/govuk-crest.svg',
        headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
