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

const APPLICATION_ID = 'app-conf-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    applicationStatus: 'Sent',
    accreditationReference: 'EPR-ACC-2027-000001',
    prns: { sectionStatus: 'Completed' },
    businessPlan: { sectionStatus: 'Completed' },
    samplingPlan: { sectionStatus: 'Completed', Files: [] },
    ...overrides
  }
}

describe('#submitConfirmationController', () => {
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

  async function getSessionCookieWithReference(
    reference = 'EPR-ACC-2027-000001'
  ) {
    // Use the submit-declaration POST to seed the session with an accreditationReference
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      accreditationReference: reference,
      applicationStatus: 'Sent'
    })

    const postResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
      headers: operatorHeaders,
      payload: {
        fullName: 'Jane Smith',
        jobTitle: 'Manager',
        submitAction: 'submit'
      }
    })

    const rawCookie = postResponse.headers['set-cookie']
    return Array.isArray(rawCookie)
      ? rawCookie[0].split(';')[0]
      : rawCookie.split(';')[0]
  }

  describe('GET /accreditation/submit-confirmation/{applicationId}', () => {
    test('redirects to task list when no applicationReference in session', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
    })

    test('renders confirmation panel when reference is in session', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="confirmation-panel"')
      expect(result).toContain('data-testid="panel-heading"')
    })

    test('displays the application reference in the panel', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference('EPR-ACC-2027-000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="application-reference"')
      expect(result).toContain('EPR-ACC-2027-000001')
    })

    test('displays payment text and action links', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="payment-text"')
      expect(result).toContain('data-testid="view-invoice-link"')
      expect(result).toContain('data-testid="return-home-link"')
    })

    test('redirects to task list on second visit after session is cleared', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      // First visit — renders and clears session
      const firstResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })
      expect(firstResponse.statusCode).toBe(statusCodes.ok)

      const updatedCookie = firstResponse.headers['set-cookie']
      const clearedCookie = Array.isArray(updatedCookie)
        ? updatedCookie[0].split(';')[0]
        : updatedCookie
          ? updatedCookie.split(';')[0]
          : cookie

      // Second visit — session cleared, redirects
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: clearedCookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('renders confirmation without materialDisplay when API fallback fails', async () => {
      // materialType is not in session (declare POST does not set it), and API call fails
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="confirmation-panel"')
      expect(result).toContain('EPR-ACC-2027-000001')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Application submitted')
    })
  })
})
