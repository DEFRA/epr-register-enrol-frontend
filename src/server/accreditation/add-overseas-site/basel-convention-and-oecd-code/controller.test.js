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

const APPLICATION_ID = 'app-bc-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`
const NEXT_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/repatriated-loads`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) return ''
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addOrsBaselCodeController', () => {
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
        'What are the Basel Convention and OECD codes for the waste?'
      )
    })

    test('renders three code inputs', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="basel-code-1-input"')
      expect(result).toContain('data-testid="basel-code-2-input"')
      expect(result).toContain('data-testid="basel-code-3-input"')
    })

    test('back link points to recycling-operation-details', async () => {
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

    test('pre-populates fields from session', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=A1181&baselConventionCode2=GC010&baselConventionCode3='
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('A1181')
      expect(result).toContain('GC010')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What are the Basel Convention and OECD codes for the waste?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to repatriated-loads when valid Basel code1 provided', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=B3011&baselConventionCode2=&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('redirects when valid OECD code1 provided', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=GC010&baselConventionCode2=&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('normalises codes to uppercase before saving', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=a1181&baselConventionCode2=gc010&baselConventionCode3='
      })

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('A1181')
      expect(result).toContain('GC010')
    })

    test('accepts codes 2 and 3 empty', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=A1181&baselConventionCode2=&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('returns 400 when code1 is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=&baselConventionCode2=&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain(
        'Enter at least one Basel Convention or OECD code'
      )
    })

    test('returns 400 when code1 has invalid format', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=INVALID&baselConventionCode2=&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter a valid Basel Convention or OECD code')
    })

    test('returns 400 when code2 has invalid format', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'baselConventionCode1=A1181&baselConventionCode2=BADCODE&baselConventionCode3='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter a valid Basel Convention or OECD code')
    })
  })
})
