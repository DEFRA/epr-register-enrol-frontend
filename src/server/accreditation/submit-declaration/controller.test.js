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
import { validateDeclaration } from './controller.js'

const APPLICATION_ID = 'app-decl-001'
const ORGANISATION_NAME = 'Acme Recycling Ltd'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    organisationName: ORGANISATION_NAME,
    applicationStatus: 'InProgress',
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
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
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

    test('renders the declaration intro and bulleted list, interpolating the organisation name', async () => {
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
        `eligible to submit this application on behalf of ${ORGANISATION_NAME}`
      )
      expect(result).toContain('the information you are submitting is accurate')
      expect(result).toContain(
        'you understand that you may face enforcement action if you submit false or misleading data'
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
          email: 'operator@test.example'
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
          email: 'operator@test.example'
        },
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
        expect.stringContaining(
          'response: {"message":"upstream case management failure"}'
        )
      )
    })
  })
})
