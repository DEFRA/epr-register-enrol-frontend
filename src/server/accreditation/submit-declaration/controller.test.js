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
import { validateDeclaration } from './controller.js'

const APPLICATION_ID = 'app-decl-001'
const ORGANISATION_NAME = 'Acme Recycling Ltd'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    orgId: 500500,
    organisationName: ORGANISATION_NAME,
    applicationStatus: 'Started',
    ...overrides
  }
}

describe('#validateDeclaration', () => {
  test('returns no errors when fullName and jobTitle are provided', () => {
    expect(validateDeclaration('Jane Smith', 'Director', t)).toEqual({})
  })

  test('returns fullName error when fullName is empty string', () => {
    const errors = validateDeclaration('', 'Director', t)
    expect(errors.fullName).toBeDefined()
    expect(errors.fullName.text).toBe('fullNameRequired')
  })

  test('returns fullName error when fullName is whitespace only', () => {
    const errors = validateDeclaration('   ', 'Director', t)
    expect(errors.fullName).toBeDefined()
  })

  test('returns jobTitle error when jobTitle is empty', () => {
    const errors = validateDeclaration('Jane Smith', '', t)
    expect(errors.jobTitle).toBeDefined()
    expect(errors.jobTitle.text).toBe('jobTitleRequired')
  })

  test('returns fullName error when fullName is null', () => {
    const errors = validateDeclaration(null, 'Director', t)
    expect(errors.fullName).toBeDefined()
  })
})

describe('#submitDeclarationController', () => {
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
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
  })

  const operatorHeaders = {
    'x-test-user-type': 'operator'
  }

  describe('GET /accreditation/submit-declaration/{applicationId}', () => {
    test('returns 200 and renders page heading', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Declaration')
    })

    test('renders the declaration intro and bulleted list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="declaration-intro"')
      expect(result).toContain(
        'By entering your name and submitting this application, you are verifying:'
      )
      expect(result).toContain('data-testid="declaration-bullets"')
      expect(result).toContain(
        'you are an approved person for your organisation OR an approved person has confirmed by email to your regulator that they authorise this submission'
      )
      expect(result).toContain('the information you are submitting is accurate')
      expect(result).toContain(
        'you understand that you may face enforcement action if you submit false or misleading information'
      )
    })

    test('renders full name and job title inputs with hints', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="full-name-input"')
      expect(result).toContain('data-testid="full-name-hint"')
      expect(result).toContain(
        'This is your full name as it appears on this account'
      )
      expect(result).toContain('data-testid="job-title-input"')
      expect(result).toContain('data-testid="job-title-hint"')
      expect(result).toContain('Enter your job title')
      expect(result).not.toContain('data-testid="email-input"')
    })

    test('renders confirm-and-submit and save-and-come-back buttons', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="submit-button"')
      expect(result).toContain('Confirm and submit')
      expect(result).toContain('data-testid="save-come-back-button"')
    })

    test('back link points to the task list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/task-list/${APPLICATION_ID}"`
      )
    })

    test('pre-fills full name and job title from session after save-and-come-back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'saveAndComeLater'
        }
      })

      const rawCookie = postResponse.headers['set-cookie']
      const cookieHeader = Array.isArray(rawCookie)
        ? rawCookie[0].split(';')[0]
        : rawCookie.split(';')[0]

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookieHeader }
      })

      expect(result).toContain('value="Jane Smith"')
      expect(result).toContain('value="Director"')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Declaration')
    })

    test('returns 500 when the application fails to load', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    // RA-481: back-navigating to submit-declaration after the application has
    // already been submitted must not re-show the actionable form.
    test('redirects to the landing page instead of re-rendering the form when the application is already submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          registrationId: 'reg-001',
          materialType: 'plastic',
          year: 2026
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/operator-accreditation/test-operator-id/reg-001/plastic/2026`
      )
    })
  })

  describe('POST /accreditation/submit-declaration/{applicationId} - saveAndComeLater', () => {
    test('redirects to task list without calling the submit API', async () => {
      const postSpy = vi.spyOn(apiClient, 'post')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(postSpy).not.toHaveBeenCalled()
    })

    // RA-481: a back-buttoned "save and come back later" on an already
    // actioned application must not write stale declaration values into the
    // session (which could later pre-fill a different application's
    // declaration form) — it must be gated exactly like a real submit.
    test('redirects to the landing page instead of saving when the application is already submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          registrationId: 'reg-001',
          materialType: 'plastic',
          year: 2026
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/operator-accreditation/test-operator-id/reg-001/plastic/2026`
      )
    })
  })

  describe('POST /accreditation/submit-declaration/{applicationId} - already submitted', () => {
    // RA-481: back-navigating and re-posting the declaration form after
    // submission must not resubmit the application.
    test('redirects to the landing page instead of submitting again', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          registrationId: 'reg-001',
          materialType: 'plastic',
          year: 2026
        })
      )
      const postSpy = vi.spyOn(apiClient, 'post')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/operator-accreditation/test-operator-id/reg-001/plastic/2026`
      )
      expect(postSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /accreditation/submit-declaration/{applicationId} - submit', () => {
    test('returns 400 with error when fullName is missing', async () => {
      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: '',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="full-name-error"')
    })

    test('returns 400 with error when jobTitle is missing', async () => {
      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: '',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="job-title-error"')
      expect(result).toContain('href="#jobTitle"')
    })

    test('calls submitApplication with fullName, jobTitle, the authenticated operator email and a 20s timeout, and redirects to confirmation', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        accreditationReference: 'RA-000000001',
        applicationStatus: 'Submitted'
      })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/submit-confirmation/${APPLICATION_ID}`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/submit`),
        {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          email: 'operator@test.example',
          // RA-503: the operator's real bank payment reference, computed from the fetched
          // application's organisationId/nation/isExporter (buildPaymentReference).
          paymentReference: 'PR/PK/REP/500500'
        },
        { timeout: 20000 }
      )
    })

    test('trims whitespace from fullName and jobTitle before submitting', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        accreditationReference: 'RA-000000001',
        applicationStatus: 'Submitted'
      })

      await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: '  Jane Smith  ',
          jobTitle: '  Director  ',
          submitAction: 'submit'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.any(String),
        {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          email: 'operator@test.example',
          paymentReference: 'PR/PK/REP/500500'
        },
        { timeout: 20000 }
      )
    })

    // RA-503: organisationId is ReEx's internal ObjectId on a real submission - orgId is the
    // operator/regulator-safe numeric organisation number that must actually be quoted on a
    // bank transfer. Confirms the submitted paymentReference is built from orgId, not
    // organisationId, when the backend sends both.
    test('builds the submitted payment reference from orgId, not the raw ObjectId-shaped organisationId', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          orgId: 500500,
          organisationId: '6a74a6a12b7c39b0cc15ca55'
        })
      )
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        accreditationReference: 'RA-000000001',
        applicationStatus: 'Submitted'
      })

      await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ paymentReference: 'PR/PK/REP/500500' }),
        { timeout: 20000 }
      )
    })

    test('returns 500 service-problem page when submitApplication API fails with server error', async () => {
      const err = Object.assign(new Error('API error'), { status: 500 })
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="try-again-link"')
    })

    test('logs the API error response body when submitApplication fails', async () => {
      const err = Object.assign(new Error('API request failed: 500'), {
        status: 500,
        response: '{"message":"upstream case management failure"}'
      })
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)
      const loggerSpy = vi.spyOn(server.logger, 'error')

      await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseBody: '{"message":"upstream case management failure"}'
        }),
        'Error submitting application'
      )
    })
  })

  // The business rule: mandatory site details are enforced before the
  // application is submitted, even for a site the operator never opened (one
  // that came with the application from Re/Ex).
  describe('a site in the application is missing details', () => {
    const LIST_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`
    const DECLARATION_URL = `/accreditation/submit-declaration/${APPLICATION_ID}`
    const COMPLETE_SITE = {
      siteId: 900001,
      siteName: 'Site Alpha',
      country: 'Germany',
      addressLine1: '123 Test St',
      townOrCity: 'Berlin',
      coordinates: '52.5200, 13.4050',
      contactName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      operationCodes: ['R3'],
      code1: 'A1181',
      repatriatedLoads: 'Returned within 30 days',
      selected: true
    }
    const INCOMPLETE_SITE = {
      siteId: 900002,
      siteName: 'Site Beta',
      country: 'France',
      selected: true
    }

    const withSites = (...sites) =>
      makeApplication({
        materialType: 'Plastic',
        isExporter: true,
        overseasSites: { sectionStatus: 'Completed', sites }
      })

    const declare = (cookie) =>
      server.inject({
        method: 'POST',
        url: DECLARATION_URL,
        headers: { ...operatorHeaders, ...(cookie ? { cookie } : {}) },
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'submit'
        }
      })

    test('the declaration page turns the operator back to the site list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        withSites(COMPLETE_SITE, INCOMPLETE_SITE)
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(LIST_URL)
    })

    test('and the list explains why, naming the site, once', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        withSites(COMPLETE_SITE, INCOMPLETE_SITE)
      )
      const turnedBack = await server.inject({
        method: 'GET',
        url: DECLARATION_URL,
        headers: operatorHeaders
      })
      const cookie = turnedBack.headers['set-cookie']
        .map((c) => c.split(';')[0])
        .join('; ')

      const list = await server.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(list.result).toContain('data-testid="error-summary"')
      expect(list.result).toContain(
        `<a href="${LIST_URL}/edit/900002" data-testid="incomplete-site-error-0">Complete the missing details for Site Beta</a>`
      )
      expect(list.result).not.toContain(
        'Complete the missing details for Site Alpha'
      )
    })

    test('submitting is refused, and nothing is sent to the backend', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(withSites(INCOMPLETE_SITE))
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await declare()

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(LIST_URL)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('save and come back later still works, since nothing is submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(withSites(INCOMPLETE_SITE))

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: DECLARATION_URL,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
    })

    test('is not in the way when every site is complete', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(withSites(COMPLETE_SITE))
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        accreditationReference: 'RA-000000001',
        applicationStatus: 'Submitted'
      })

      const page = await server.inject({
        method: 'GET',
        url: DECLARATION_URL,
        headers: operatorHeaders
      })
      const { statusCode, headers } = await declare()

      expect(page.statusCode).toBe(statusCodes.ok)
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/submit-confirmation/${APPLICATION_ID}`
      )
      expect(postSpy).toHaveBeenCalled()
    })

    test('ignores a registered site that was never included', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        withSites(COMPLETE_SITE, { ...INCOMPLETE_SITE, selected: false })
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('does not affect an application with no overseas sites (a non-exporter)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: false })
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DECLARATION_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
