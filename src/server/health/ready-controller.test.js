import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#readyController', () => {
  let server
  // Lets individual tests flex config values to exercise the missing-key
  // branches without re-spying config.get (see operator-accreditation/controller.test.js
  // for the established rationale — re-spying an already-spied method recurses
  // into itself rather than layering).
  let configOverrides = {}

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key in configOverrides) {
        return configOverrides[key]
      }
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    configOverrides = {}
  })

  test('returns healthy when required config is present', async () => {
    configOverrides = {
      environment: 'ext-test',
      'auth.stubEnabled': false,
      'api.baseUrl': 'http://backend.test',
      'api.stubEnabled': false,
      'api.sharedSecret': 'shared-secret',
      'reex.frontendBaseUrl': 'http://reex-frontend.test',
      'auth.azureEntraId.tenantId': 'tenant-id',
      'auth.defraId.serviceId': 'service-id',
      'auth.callbackBaseUrl': 'https://app.test'
    }

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/health/ready'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({ status: 'healthy' })
  })

  test('returns 503 listing missing keys when required config is absent', async () => {
    configOverrides = {
      environment: 'ext-test',
      'auth.stubEnabled': false,
      'api.baseUrl': '',
      'api.stubEnabled': false
    }

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/health/ready'
    })

    expect(statusCode).toBe(statusCodes.serviceUnavailable)
    expect(result.status).toBe('unhealthy')
    expect(result.missing).toContain('API_BASE_URL')
  })

  test('is healthy by default in local dev config, with no overrides', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/health/ready'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual({ status: 'healthy' })
  })
})
