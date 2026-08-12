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
const SITE_NAME_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
const SITE_LOCATION_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-location`

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
    'x-test-user-type': 'operator'
  }

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  async function seedSiteNameAndAddress() {
    const nameResponse = await server.inject({
      method: 'POST',
      url: SITE_NAME_URL,
      headers: postHeaders,
      payload: 'siteName=Rotterdam Recycling BV'
    })

    const locationResponse = await server.inject({
      method: 'POST',
      url: SITE_LOCATION_URL,
      headers: { ...postHeaders, cookie: cookiesFrom(nameResponse) },
      payload:
        'addressLine1=1 Havenweg&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C%204.47917'
    })

    return cookiesFrom(locationResponse)
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
        'What are the Basel Convention codes for the waste?'
      )
    })

    test('renders a single code input and no remove button by default', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="basel-code-1-input"')
      expect(result).not.toContain('data-testid="basel-code-2-input"')
      expect(result).not.toContain('data-testid="remove-code-1-button"')
      expect(result).toContain('data-testid="add-code-button"')
    })

    test('shows the site name and address', async () => {
      const cookie = await seedSiteNameAndAddress()
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="site-summary"')
      expect(result).toContain('Rotterdam Recycling BV')
      expect(result).toContain('1 Havenweg')
      expect(result).toContain('Rotterdam')
      expect(result).toContain('Netherlands')
    })

    test('shows a GDS-style guidance link that opens in a new tab', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="guidance-link"')
      expect(result).toContain(
        'https://www.gov.uk/government/publications/waste-shipments-regulation-wsr-consolidated-waste-list'
      )
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noreferrer noopener"')
      expect(result).toContain('(opens in new tab)')
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

    test('pre-populates multiple fields and remove buttons from session', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=2&code-0=A1181&code-1=GC010'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('data-testid="basel-code-1-input"')
      expect(result).toContain('data-testid="basel-code-2-input"')
      expect(result).toContain('value="A1181"')
      expect(result).toContain('value="GC010"')
      expect(result).toContain('data-testid="remove-code-1-button"')
      expect(result).toContain('data-testid="remove-code-2-button"')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What are the Basel Convention codes for the waste?'
      )
    })
  })

  describe(`POST ${BASE_URL} add/remove`, () => {
    test('addCode grows the visible inputs and preserves entered values', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=addCode&visibleCount=1&code-0=A1181'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('value="A1181"')
      expect(result).toContain('data-testid="basel-code-2-input"')
    })

    test('addCode is capped at 3 visible inputs', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'action=addCode&visibleCount=3&code-0=A1181&code-1=A1181&code-2=A1181'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="add-code-button"')
      expect(result).not.toContain('data-testid="basel-code-4-input"')
    })

    test('removeCode-N drops that entry and preserves the rest', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'action=removeCode-1&visibleCount=3&code-0=A1181&code-1=GC010&code-2=B3011'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="basel-code-3-input"')
      expect(result).toContain('value="A1181"')
      expect(result).toContain('value="B3011"')
      expect(result).not.toContain('value="GC010"')
    })

    test('removeCode never drops below one visible input', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=removeCode-0&visibleCount=1&code-0=A1181'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="basel-code-1-input"')
      expect(result).not.toContain('data-testid="remove-code-1-button"')
    })
  })

  describe(`POST ${BASE_URL} continue`, () => {
    test('redirects to repatriated-loads when a valid Basel code is provided', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=1&code-0=B3011'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('redirects when a valid OECD code is provided', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=1&code-0=GC010'
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('normalises codes to uppercase before saving', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=2&code-0=a1181&code-1=gc010'
      })

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('A1181')
      expect(result).toContain('GC010')
    })

    test('clamps a spoofed visibleCount server-side, ignoring codes beyond MAX_CODES', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'action=continue&visibleCount=10&code-0=A1181&code-1=GC010&code-2=B3011&code-3=Y1010&code-4=Y2020'
      })

      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      expect(postResponse.headers.location).toBe(NEXT_URL)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('value="A1181"')
      expect(result).toContain('value="GC010"')
      expect(result).toContain('value="B3011"')
      expect(result).not.toContain('value="Y1010"')
      expect(result).not.toContain('value="Y2020"')
      expect(result).not.toContain('data-testid="basel-code-4-input"')
    })

    test('leaving all codes blank is allowed and continues the journey', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=1&code-0='
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('blank slots amongst entered codes are dropped, not saved', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'action=continue&visibleCount=3&code-0=A1181&code-1=&code-2=B3011'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toContain('data-testid="basel-code-1-input"')
      expect(result).toContain('data-testid="basel-code-2-input"')
      expect(result).not.toContain('data-testid="basel-code-3-input"')
      expect(result).toContain('value="A1181"')
      expect(result).toContain('value="B3011"')
    })

    test('returns 400 when an entered code has an invalid format', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=1&code-0=INVALID'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter a valid Basel Convention or OECD code')
    })

    test('returns 400 when the second entered code has an invalid format', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'action=continue&visibleCount=2&code-0=A1181&code-1=BADCODE'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter a valid Basel Convention or OECD code')
    })
  })
})
