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
import { validateQueryDeclaration } from './controller.js'

const APPLICATION_ID = 'app-query-002'

const t = (key) => {
  const last = key.split('.').pop()
  if (last === 'emailInvalid') {
    return 'Enter an email address in the correct format, like name@example.com'
  }
  return last
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
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

describe('#validateQueryDeclaration', () => {
  test('returns no errors for valid input', () => {
    const errors = validateQueryDeclaration(
      'Jane Doe',
      'jane@example.com',
      'Manager',
      t
    )
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('requires fullName', () => {
    const errors = validateQueryDeclaration(
      '',
      'jane@example.com',
      'Manager',
      t
    )
    expect(errors.fullName).toBeDefined()
  })

  test('requires email', () => {
    const errors = validateQueryDeclaration('Jane Doe', '', 'Manager', t)
    expect(errors.email).toBeDefined()
  })

  test('rejects malformed email', () => {
    const errors = validateQueryDeclaration(
      'Jane Doe',
      'not-an-email',
      'Manager',
      t
    )
    expect(errors.email.text).toContain('name@example.com')
  })

  test('requires role', () => {
    const errors = validateQueryDeclaration(
      'Jane Doe',
      'jane@example.com',
      '',
      t
    )
    expect(errors.role).toBeDefined()
  })
})

describe('#queryDeclarationController', () => {
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

  describe('GET /accreditation/query-declaration/{applicationId}', () => {
    test('returns 200 with the declaration form when Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('redirects to the landing page when applicationStatus is not Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Updated' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain('/operator-accreditation/')
    })
  })

  describe('POST /accreditation/query-declaration/{applicationId}', () => {
    test('re-renders form with validation errors when fields missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { fullName: '', email: '', role: '' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('calls resubmit and redirects to landing page on success', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(makeApplication({ applicationStatus: 'Updated' }))

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Manager'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/resubmit'),
        expect.objectContaining({
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Manager'
        })
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain('/operator-accreditation/')
    })

    test('surfaces a 409 conflict explicitly instead of redirecting as if succeeded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Conflict')
      err.status = 409
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(409)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('surfaces a 502 adapter failure explicitly and allows retry', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Bad Gateway')
      err.status = 502
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(502)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('redirects to landing page when applicationStatus is stale on submit', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Updated' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain('/operator-accreditation/')
    })
  })
})
