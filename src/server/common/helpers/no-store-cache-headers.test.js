import { vi } from 'vitest'

import { noStoreCacheHeaders } from './no-store-cache-headers.js'
import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'
import { config } from '../../../config/config.js'

describe('#noStoreCacheHeaders', () => {
  test('sets no-store headers on a view response', () => {
    const mockHeader = vi.fn()
    const request = {
      response: { variety: 'view', header: mockHeader }
    }
    const h = { continue: Symbol('continue') }

    const result = noStoreCacheHeaders(request, h)

    expect(mockHeader).toHaveBeenCalledWith(
      'cache-control',
      'no-store, no-cache, must-revalidate'
    )
    expect(mockHeader).toHaveBeenCalledWith('pragma', 'no-cache')
    expect(result).toBe(h.continue)
  })

  test('leaves non-view responses untouched', () => {
    const mockHeader = vi.fn()
    const request = {
      response: { variety: 'file', header: mockHeader }
    }
    const h = { continue: Symbol('continue') }

    const result = noStoreCacheHeaders(request, h)

    expect(mockHeader).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })
})

describe('#noStoreCacheHeaders integration', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('rendered pages are not cacheable by the browser', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        'x-test-user-type': 'operator'
      }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['cache-control']).toBe('no-store, no-cache, must-revalidate')
    expect(headers.pragma).toBe('no-cache')
  })
})
