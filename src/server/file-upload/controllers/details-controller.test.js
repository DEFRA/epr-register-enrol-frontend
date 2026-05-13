import { describe, test, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'

describe('#fileUploadDetailsController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const authHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  describe('GET /file-upload/add', () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/file-upload/add',
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders material select dropdown', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/file-upload/add',
        headers: authHeaders
      })

      expect(result).toContain('data-testid="select-material"')
    })

    test('renders year select dropdown', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/file-upload/add',
        headers: authHeaders
      })

      expect(result).toContain('data-testid="select-year"')
    })

    test('returns 200 for Welsh locale', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/cy/file-upload/add',
        headers: authHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('POST /file-upload/add', () => {
    test('returns 400 with error summary when material is missing', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/file-upload/add',
        headers: authHeaders,
        payload: { year: '2025' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="field-error-material"')
    })

    test('returns 400 with error summary when year is missing', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/file-upload/add',
        headers: authHeaders,
        payload: { material: 'Steel' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="field-error-year"')
    })

    test('returns 400 with two errors when both fields are missing', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/file-upload/add',
        headers: authHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="field-error-material"')
      expect(result).toContain('data-testid="field-error-year"')
    })

    test('redirects to /file-upload/upload on valid submission', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/file-upload/add',
        headers: authHeaders,
        payload: { material: 'Steel', year: '2025' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe('/file-upload/upload')
    })
  })
})
