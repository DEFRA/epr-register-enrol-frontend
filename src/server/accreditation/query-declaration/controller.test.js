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
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { validateQueryDeclaration } from './controller.js'
import { TEST_OPERATOR } from '../../common/helpers/auth/stub-auth-plugin.js'

const APPLICATION_ID = 'app-query-002'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    organisationName: 'Acme Recycling Ltd',
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

describe('#validateQueryDeclaration', () => {
  test('returns no errors for valid input', () => {
    const errors = validateQueryDeclaration('Jane Doe', 'Manager', t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('requires fullName', () => {
    const errors = validateQueryDeclaration('', 'Manager', t)
    expect(errors.fullName).toBeDefined()
  })

  test('requires role', () => {
    const errors = validateQueryDeclaration('Jane Doe', '', t)
    expect(errors.role).toBeDefined()
  })
})

describe('#queryDeclarationController', () => {
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

  describe('GET /accreditation/query-declaration/{applicationId}', () => {
    test('returns 200 with the declaration form when Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
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
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('renders the bulleted declaration list alongside the retained warning box', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="declaration-bullets"')
      expect(result).toContain(
        'you are an approved person for your organisation OR an approved person has confirmed by email to your regulator that they authorise this submission'
      )
      expect(result).toContain('the information you are submitting is accurate')
      expect(result).toContain(
        'you understand that you may face enforcement action if you submit false or misleading information'
      )
      expect(result).not.toContain('data-testid="warning-text"')
      expect(result).toContain(
        'This is your full name as it appears on this account'
      )
      expect(result).toContain(
        'This is your job title as it appears on this account'
      )
      expect(result).toContain('aria-describedby="fullName-hint"')
    })

    test('returns 500 with a fetch error message when the application lookup fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('boom'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(500)
      expect(result).toContain(
        'Sorry, there was a problem loading your application. Please try again.'
      )
    })

    test('renders without an organisation name when the application has none', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        makeApplication({ organisationName: undefined })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('shows the full name and job title fields (no email field) and the resubmit button label', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="full-name-input"')
      expect(result).not.toContain('data-testid="email-input"')
      expect(result).toContain('data-testid="role-input"')
      expect(result).toContain('data-testid="resubmit-button"')
      expect(result).toContain('Resubmit application')
    })
  })

  describe('POST /accreditation/query-declaration/{applicationId}', () => {
    test('re-renders form with validation errors when fields missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: { fullName: '', role: '' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('re-renders form with validation errors when no payload is sent at all', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('re-renders form with validation errors without an organisation name when the application has none', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        makeApplication({ organisationName: undefined })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: { fullName: '', role: '' }
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
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/resubmit'),
        expect.objectContaining({
          fullName: 'Jane Doe',
          email: TEST_OPERATOR.email,
          role: 'Manager'
        })
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('ignores an email in the payload and uses the signed-in operator email', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(makeApplication({ applicationStatus: 'Updated' }))

      await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          email: 'attacker@example.com',
          role: 'Manager'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/resubmit'),
        expect.objectContaining({ email: TEST_OPERATOR.email })
      )
    })

    // RA-519: since RA-503, the backend also sends the numeric orgId on every
    // read. The post-resubmit redirect must still be built from the internal
    // organisationId, not orgId, or it 404s against the accreditation API
    // (orgId is not a valid organisation id).
    test('redirect uses organisationId, not orgId, when the backend sends both', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ orgId: 500504 })
      )
      vi.spyOn(apiClient, 'post').mockResolvedValue(
        makeApplication({ orgId: 500504, applicationStatus: 'Updated' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })

    test('redirect never contains "undefined", even with no session set for this journey', async () => {
      // Regression guard for the OJ resubmit duplicate-document bug: the
      // post-resubmit redirect must be built from the fetched application,
      // not request.yar, since a query-response journey (e.g. via an
      // emailed link on another device) can outlive the session values
      // written when the landing page was first visited.
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'post').mockResolvedValue(
        makeApplication({ applicationStatus: 'Updated' })
      )

      const { headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(headers.location).not.toContain('undefined')
    })

    test('surfaces a 409 conflict explicitly instead of redirecting as if succeeded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Conflict')
      err.status = 409
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(409)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('surfaces a 409 conflict without an organisation name when the application has none', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        makeApplication({ organisationName: undefined })
      )
      const err = new Error('Conflict')
      err.status = 409
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
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
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(502)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('surfaces a 502 adapter failure without an organisation name when the application has none', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        makeApplication({ organisationName: undefined })
      )
      const err = new Error('Bad Gateway')
      err.status = 502
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(502)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('returns 500 with a fetch error message when the application lookup fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('boom'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(500)
      expect(result).toContain(
        'Sorry, there was a problem loading your application. Please try again.'
      )
    })

    test('shows the generic service-problem page for an unspecified (>=500) resubmit failure', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Internal Server Error')
      err.status = 503
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(500)
      expect(result).toContain('Sorry, there is a problem with the service')
    })

    test('shows the generic service-problem page when the resubmit error has no status', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('Network failure')
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(500)
      expect(result).toContain('Sorry, there is a problem with the service')
    })

    test('re-renders the declaration form with a generic error for an unmapped 4xx resubmit failure', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = new Error('I am a teapot')
      err.status = 418
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(400)
      expect(result).toContain('data-testid="declaration-form"')
      expect(result).toContain(
        'Sorry, there was a problem resubmitting your application. Please try again.'
      )
    })

    test('re-renders form for an unmapped 4xx resubmit failure without an organisation name when the application has none', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        makeApplication({ organisationName: undefined })
      )
      const err = new Error('I am a teapot')
      err.status = 418
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(400)
      expect(result).toContain('data-testid="declaration-form"')
    })

    test('redirects to landing page when applicationStatus is stale on submit', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Updated' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/query-declaration/${APPLICATION_ID}`,
        payload: {
          fullName: 'Jane Doe',
          role: 'Manager'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
      )
    })
  })

  // A query response is also a submission: a site that is missing details has
  // to be fixed first - but only when the operator is able to fix it.
  describe('a site in the application is missing details', () => {
    const LIST_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`
    const DECLARATION_URL = `/accreditation/query-declaration/${APPLICATION_ID}`
    const INCOMPLETE_SITE = {
      siteId: 900002,
      siteName: 'Site Beta',
      country: 'France',
      selected: true
    }

    const withOverseasSites = (sectionStatus) =>
      makeApplication({
        isExporter: true,
        overseasSites: { sectionStatus, sites: [INCOMPLETE_SITE] }
      })

    test('GET turns the operator back to the site list when that section was queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(withOverseasSites('Queried'))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(LIST_URL)
    })

    test('POST refuses to resubmit, and nothing is sent to the backend', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(withOverseasSites('Queried'))
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: DECLARATION_URL,
        payload: { fullName: 'Jane Doe', role: 'Manager' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(LIST_URL)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('does not trap the operator when the sites section is read-only for this query', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        withOverseasSites('Completed')
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('lets a queried application with complete sites through', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          overseasSites: {
            sectionStatus: 'Queried',
            sites: [
              {
                siteId: 900001,
                siteName: 'Site Alpha',
                country: 'Germany',
                addressLine1: '123 Test St',
                townOrCity: 'Berlin',
                coordinates: '52.5200, 13.4050',
                contactName: 'Jane Smith',
                contactEmail: 'jane@example.com',
                operationCodes: ['R4'],
                code1: 'A1181',
                repatriatedLoads: 'Returned within 30 days',
                conditionsOfExport: true,
                selected: true
              }
            ]
          }
        })
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
