import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { config } from '../../../../config/config.js'

const APPLICATION_ID = 'app-rod-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-contact-details`
const NEXT_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) return ''
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addOrsRecyclingOperationController', () => {
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

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain(
        'What recycling operation is carried out at the site?'
      )
    })

    test('renders radio buttons for R3 and R4 only', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="option-R3"')
      expect(result).toContain('data-testid="option-R4"')
      expect(result).not.toContain('data-testid="option-R1"')
      expect(result).not.toContain('data-testid="option-R5"')
      expect(result).not.toContain('data-testid="option-R13"')
      expect(result).toContain('type="radio"')
    })

    test('back link points to site-contact-details', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    test('pre-selects option from session when returning via Back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCode=R4'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('value="R4"')
      expect(result).toMatch(/value="R4"\s+checked/)
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What recycling operation is carried out at the site?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to basel-convention-and-oecd-code when valid code selected', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCode=R3'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('returns 400 with error when no operation selected', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCode='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select a recycling operation')
      expect(result).toContain('id="recycling-operation-code-error"')
      expect(result).toContain(
        'aria-describedby="recycling-operation-code-error"'
      )
    })

    test('returns 400 rather than 500 when the field name is submitted twice', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCode=R3&recyclingOperationCode=R4'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select a recycling operation')
    })

    test('returns 400 with error when an operation code outside R3/R4 is submitted', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCode=R5'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select a recycling operation')
    })
  })
})
