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

const t = (key) => key.split('.').pop()

describe('#validateDeclaration', () => {
  test('returns no errors when fullName and jobTitle provided', () => {
    expect(validateDeclaration('Jane Smith', 'Manager', t)).toEqual({})
  })

  test('returns fullName error when fullName is empty string', () => {
    const errors = validateDeclaration('', 'Manager', t)
    expect(errors.fullName).toBeDefined()
    expect(errors.fullName.text).toBe('fullNameRequired')
  })

  test('returns fullName error when fullName is whitespace only', () => {
    const errors = validateDeclaration('   ', 'Manager', t)
    expect(errors.fullName).toBeDefined()
  })

  test('returns fullName error when fullName is null', () => {
    const errors = validateDeclaration(null, 'Manager', t)
    expect(errors.fullName).toBeDefined()
  })

  test('returns jobTitle error when jobTitle is empty string', () => {
    const errors = validateDeclaration('Jane Smith', '', t)
    expect(errors.jobTitle).toBeDefined()
    expect(errors.jobTitle.text).toBe('jobTitleRequired')
  })

  test('returns jobTitle error when jobTitle is whitespace only', () => {
    const errors = validateDeclaration('Jane Smith', '   ', t)
    expect(errors.jobTitle).toBeDefined()
  })

  test('returns both errors when fullName and jobTitle are missing', () => {
    const errors = validateDeclaration('', '', t)
    expect(errors.fullName).toBeDefined()
    expect(errors.jobTitle).toBeDefined()
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
    })

    test('renders full name and job title inputs', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="full-name-input"')
      expect(result).toContain('data-testid="job-title-input"')
    })

    test('renders submit and save-and-come-back buttons', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="submit-button"')
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

    test('pre-fills inputs from session after save-and-come-back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Senior Manager',
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
      expect(result).toContain('value="Senior Manager"')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Submit accreditation application')
    })
  })

  describe('POST /accreditation/submit-declaration/{applicationId} - saveAndComeLater', () => {
    test('redirects to task list without calling the API', async () => {
      const postSpy = vi.spyOn(apiClient, 'post')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Manager',
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
        payload: { fullName: '', jobTitle: 'Manager', submitAction: 'submit' }
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
    })

    test('returns 400 when both fields are missing', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { fullName: '', jobTitle: '', submitAction: 'submit' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="full-name-error"')
      expect(result).toContain('data-testid="job-title-error"')
    })

    test('calls submitApplication and redirects to confirmation on valid data', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
<<<<<<< HEAD
        AccreditationReference: 'EPR-ACC-2027-000001',
        ApplicationStatus: 'Sent'
=======
        applicationReference: 'EPR-ACC-2027-000001',
        applicationStatus: 'Sent'
>>>>>>> 6010d4f (featrure/RA-119-Mongo-Persistence|Camelcase property mismatch fix)
      })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Senior Manager',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/submit-confirmation/${APPLICATION_ID}`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/submit`),
        { fullName: 'Jane Smith', jobTitle: 'Senior Manager' }
      )
    })

    test('trims whitespace from inputs before submitting', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
<<<<<<< HEAD
        AccreditationReference: 'EPR-ACC-2027-000001',
        ApplicationStatus: 'Sent'
=======
        applicationReference: 'EPR-ACC-2027-000001',
        applicationStatus: 'Sent'
>>>>>>> 6010d4f (featrure/RA-119-Mongo-Persistence|Camelcase property mismatch fix)
      })

      await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: '  Jane Smith  ',
          jobTitle: '  Senior Manager  ',
          submitAction: 'submit'
        }
      })

      expect(postSpy).toHaveBeenCalledWith(expect.any(String), {
        fullName: 'Jane Smith',
        jobTitle: 'Senior Manager'
      })
    })

    test('returns 500 with error summary when submitApplication API fails', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('API error'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Manager',
          submitAction: 'submit'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('re-renders with submitted field values on API error', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('API error'))

      const { result } = await server.inject({
        method: 'POST',
        url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          fullName: 'Jane Smith',
          jobTitle: 'Manager',
          submitAction: 'submit'
        }
      })

      expect(result).toContain('value="Jane Smith"')
    })
  })
})
