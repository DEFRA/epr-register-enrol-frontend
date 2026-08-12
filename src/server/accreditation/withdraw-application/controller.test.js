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
import { apiClient } from '../../common/api-client.js'
import { validateWithdrawApplication } from './controller.js'

const APPLICATION_ID = 'app-withdraw-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    registrationId: 'test-registration-id',
    materialType: 'Steel',
    year: 2027,
    applicationStatus: 'Submitted',
    ...overrides
  }
}

describe('#validateWithdrawApplication', () => {
  test('returns no errors for a valid "yes" with reason', () => {
    const errors = validateWithdrawApplication('yes', 'Changed our minds', t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('returns no errors for "no"', () => {
    const errors = validateWithdrawApplication('no', '', t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('requires confirmWithdraw to be yes or no', () => {
    const errors = validateWithdrawApplication(undefined, '', t)
    expect(errors.confirmWithdraw).toBeDefined()
  })

  test('requires a reason when confirmWithdraw is yes', () => {
    const errors = validateWithdrawApplication('yes', '', t)
    expect(errors.reason).toBeDefined()
  })

  test('requires a reason when confirmWithdraw is yes and reason is whitespace only', () => {
    const errors = validateWithdrawApplication('yes', '   ', t)
    expect(errors.reason).toBeDefined()
  })

  test('rejects a reason over 200 words', () => {
    const reason = Array(201).fill('word').join(' ')
    const errors = validateWithdrawApplication('yes', reason, t)
    expect(errors.reason).toBeDefined()
  })

  test('accepts a reason of exactly 200 words', () => {
    const reason = Array(200).fill('word').join(' ')
    const errors = validateWithdrawApplication('yes', reason, t)
    expect(errors.reason).toBeUndefined()
  })
})

describe('#withdrawApplicationController', () => {
  let server

  beforeAll(async () => {
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
    'x-test-user-type': 'operator'
  }

  describe('GET /accreditation/withdraw-application/{applicationId}', () => {
    test('returns 200 with the withdraw form for a withdrawable status', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="withdraw-form"')
    })

    test('returns 200 when applicationStatus is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Queried' })
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test.each([
      'Saved',
      'Started',
      'NotStarted',
      'Approved',
      'Refused',
      'Cancelled',
      'Rejected',
      'Withdrawn'
    ])(
      'redirects to the landing page when applicationStatus is %s',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({ applicationStatus })
        )

        const { statusCode, headers } = await server.inject({
          method: 'GET',
          url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
        )
      }
    )
  })

  describe('POST /accreditation/withdraw-application/{applicationId}', () => {
    test('re-renders with an error when confirmWithdraw is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('confirmWithdraw=no redirects to landing without calling withdraw', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postSpy = vi.spyOn(apiClient, 'post')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'no' }
      })

      expect(postSpy).not.toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('confirmWithdraw=yes with no reason re-renders with a required-reason error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: '' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('confirmWithdraw=yes with a 201-word reason re-renders with a too-long error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          confirmWithdraw: 'yes',
          reason: Array(201).fill('word').join(' ')
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('calls withdrawApplication with the trimmed reason and redirects to the landing page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue({ applicationStatus: 'Withdrawn' })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: '  No longer required  ' }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/withdraw'),
        {
          reason: 'No longer required',
          fullName: 'Test Operator',
          email: 'operator@test.example'
        }
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('redirects to landing page when applicationStatus is stale on submit', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Approved' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: 'No longer required' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('surfaces a 409 conflict explicitly instead of redirecting as if succeeded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Conflict')
      err.status = 409
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: 'No longer required' }
      })

      expect(statusCode).toBe(409)
      expect(result).toContain('data-testid="error-message"')
    })

    test('surfaces a 502 adapter failure explicitly and allows retry', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Bad Gateway')
      err.status = 502
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: 'No longer required' }
      })

      expect(statusCode).toBe(502)
      expect(result).toContain('data-testid="withdraw-form"')
    })

    test('returns 500 service-problem view on a generic 5xx failure', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Down')
      err.status = 503
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: 'No longer required' }
      })

      expect(statusCode).toBe(500)
    })

    test('returns 500 error view when fetching the application fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/withdraw-application/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { confirmWithdraw: 'yes', reason: 'No longer required' }
      })

      expect(statusCode).toBe(500)
      expect(result).toContain('data-testid="error-message"')
    })
  })
})
