import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { apiClient } from '../../common/api-client.js'

const APPLICATION_ID = 'app-resubmit-confirm-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    registrationId: 'test-registration-id',
    materialType: 'Steel',
    year: 2027,
    applicationStatus: 'Queried',
    query: { queryNote: 'Please clarify tonnage figures.' },
    prns: { sectionStatus: 'Queried' },
    businessPlan: { sectionStatus: 'Completed' },
    samplingPlan: { sectionStatus: 'Completed' },
    ...overrides
  }
}

describe('#resubmitConfirmController', () => {
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

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  describe('GET /accreditation/resubmit-confirm/{applicationId}', () => {
    test('returns 200 with the "Submit the application" heading, body and Accept-and-submit button when Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Submit the application')
      expect(result).toContain(
        'By submitting this application you are confirming that, to the best of your knowledge, the details you are providing are correct.'
      )
      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain('Accept and submit')
    })

    test('continue button navigates (GET) to query-declaration, not a new POST endpoint', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/query-declaration/${APPLICATION_ID}"`
      )
    })

    test('back link points to query-task-list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/query-task-list/${APPLICATION_ID}"`
      )
    })

    test('redirects to the landing page when applicationStatus is not Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Updated' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('returns 500 when the application fails to load', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/resubmit-confirm/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Submit the application')
    })
  })
})
