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

const APPLICATION_ID = 'app-conf-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    applicationStatus: 'Submitted',
    accreditationReference: 'RA-000000001',
    prns: { sectionStatus: 'Completed', plannedTonnageBand: 'UpTo500' },
    businessPlan: { sectionStatus: 'Completed' },
    samplingPlan: { sectionStatus: 'Completed', Files: [] },
    ...overrides
  }
}

describe('#submitConfirmationController', () => {
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

  async function getSessionCookieWithReference(reference = 'RA-000000001') {
    // Use the submit-declaration POST to seed the session with an accreditationReference
    // submit-declaration's POST handler fetches the application (for the
    // organisation name shown in its declaration copy) before submitting.
    // Queue one successful response for that internal call so it doesn't
    // consume/clash with whatever apiClient.get mock the calling test has
    // set up for the confirmation page itself.
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(makeApplication())
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      accreditationReference: reference,
      applicationStatus: 'Submitted'
    })

    const postResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
      headers: operatorHeaders,
      payload: {
        fullName: 'Jane Smith',
        jobTitle: 'Director',
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
      const cookie = await getSessionCookieWithReference('RA-000000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="application-reference"')
      expect(result).toContain('RA-000000001')
    })

    test('panel heading prompts payment, and body has no trailing "is" suffix', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference('RA-000000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('Now pay the application charge')
      expect(result).toContain('Application reference for')
      expect(result).not.toContain('Your application reference for')
    })

    test('displays payment text and action links, with no separate payment page link', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="payment-text"')
      expect(result).toContain('data-testid="return-home-link"')
      expect(result).not.toContain('data-testid="view-payment-details-link"')
    })

    test('shows payment details inline, including amount, bank details, and the payment reference', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: { plannedTonnageBand: 'UpTo5000' }
        })
      )
      const cookie = await getSessionCookieWithReference('RA-000000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="amount-due"')
      expect(result).toContain('£2,184.00')
      expect(result).toContain('data-testid="bank-details-list"')
      expect(result).toContain('data-testid="bank-sort-code"')
      expect(result).toContain('60-70-80')
      expect(result).toContain('data-testid="bank-payment-reference"')
      expect(result).toContain('RA-000000001')
    })

    test('exporter (no siteAddress) resolves Scotland from companyRegisterAddressPostcode', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          companyRegisterAddressPostcode: 'KW2 7LZ'
        })
      )
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="bank-account-name"')
      expect(result).toContain('Scottish Environment Protection Agency')
      expect(result).toContain('83 – 34 – 00')
      expect(result).not.toContain(
        'Application submitted to the Environment Agency'
      )
    })

    test('shows the "how long payments take" content as static text, not a collapsible link', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(result).toContain('data-testid="how-long-payments-take"')
      expect(result).toContain('Bank transfers can take 3 to 5 working days')
      expect(result).not.toContain('govuk-details')
    })

    test('omits the payment details section gracefully when payment cannot be calculated', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { plannedTonnageBand: null } })
      )
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="confirmation-panel"')
      expect(result).not.toContain('data-testid="amount-due"')
    })

    test('can be revisited — session is not cleared on render', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const firstResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })
      expect(firstResponse.statusCode).toBe(statusCodes.ok)

      const updatedCookie = firstResponse.headers['set-cookie']
      const persistedCookie = Array.isArray(updatedCookie)
        ? updatedCookie[0].split(';')[0]
        : updatedCookie
          ? updatedCookie.split(';')[0]
          : cookie

      // Second visit — session still valid, page renders again
      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, Cookie: persistedCookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
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
      expect(result).toContain('RA-000000001')
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
