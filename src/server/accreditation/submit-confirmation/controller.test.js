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
import { config } from '../../../config/config.js'
import { landingUrl } from '../../common/helpers/accreditationUrls.js'

const APPLICATION_ID = 'app-conf-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    orgId: 500500,
    paymentReference: 'PR/PK/REP/500500',
    registrationId: 'reg-conf-001',
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

  async function getSessionCookieWithReference(reference = 'RA-000000001') {
    // Use the submit-declaration POST to seed the session with an accreditationReference
    // submit-declaration's POST handler fetches the application (for the
    // organisation name shown in its declaration copy) before submitting.
    // Queue one successful response for that internal call so it doesn't
    // consume/clash with whatever apiClient.get mock the calling test has
    // set up for the confirmation page itself.
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(
      makeApplication({ applicationStatus: 'Started' })
    )
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      accreditationReference: reference,
      applicationStatus: 'Submitted'
    })

    const postResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/submit-declaration/${APPLICATION_ID}`,
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
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`
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
        headers: { Cookie: cookie }
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
        headers: { Cookie: cookie }
      })

      expect(result).toContain('data-testid="application-reference"')
      expect(result).toContain('RA-000000001')
    })

    test('appends the glass recycling type suffix to the panel body material', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          materialType: 'Glass',
          glassRecyclingProcess: ['glass_re_melt']
        })
      )
      const cookie = await getSessionCookieWithReference('RA-000000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
      })

      expect(result).toContain('Glass - Remelt')
    })

    test('panel heading prompts payment, and body has no trailing "is" suffix', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference('RA-000000001')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
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
        headers: { Cookie: cookie }
      })

      expect(result).toContain('data-testid="payment-text"')
      expect(result).toContain('data-testid="return-home-link"')
      expect(result).not.toContain('data-testid="view-payment-details-link"')
    })

    test('return home link points at the application landing page (RA-453)', async () => {
      const application = makeApplication()
      vi.spyOn(apiClient, 'get').mockResolvedValue(application)
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
      })

      expect(result).toContain(
        `href="${landingUrl(application)}" class="govuk-link" data-testid="return-home-link"`
      )
    })

    test('return home link falls back to the Re-Ex frontend when the application fetch fails (RA-453)', async () => {
      const realConfigGet = config.get.bind(config)
      const spy = vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'reex.frontendBaseUrl') {
          return 'https://reex.example'
        }
        return realConfigGet(key)
      })

      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'href="https://reex.example" class="govuk-link" data-testid="return-home-link"'
      )

      spy.mockRestore()
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
        headers: { Cookie: cookie }
      })

      expect(result).toContain('data-testid="amount-due"')
      expect(result).toContain('£2,184.00')
      expect(result).toContain('data-testid="bank-details-list"')
      expect(result).toContain('data-testid="bank-sort-code"')
      expect(result).toContain('60-70-80')
      expect(result).toContain('data-testid="bank-payment-reference"')
      expect(result).toContain('PR/PK/REP/500500')
    })

    describe('regulator payment reference (RA-426)', () => {
      // RA-000: the backend builds the reference from the stored organisation
      // number and nation; the page shows that value and never rebuilds it.
      test('shows the payment reference from the application, not one rebuilt from orgId and nation', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            orgId: 500500,
            nation: 'England',
            isExporter: false,
            paymentReference: 'PREX/123456'
          })
        )
        const cookie = await getSessionCookieWithReference()

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
          headers: { Cookie: cookie }
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain(
          'data-testid="bank-payment-reference">PREX/123456</dd>'
        )
        expect(result).not.toContain('PR/PK/REP/500500')
      })

      test('application-reference is unaffected by the payment reference change', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
        const cookie = await getSessionCookieWithReference('RA-000000001')

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
          headers: { Cookie: cookie }
        })

        expect(result).toContain('data-testid="application-reference"')
        expect(result).toContain('RA-000000001')
      })
    })

    describe('contact your regulator section (RA-426)', () => {
      test.each([
        [
          'England',
          'Environment Agency',
          'packagingnotifications@environment-agency.gov.uk'
        ],
        [
          'Scotland',
          'Scottish Environment Protection Agency',
          'producer.responsibility@sepa.org.uk'
        ],
        [
          'Wales',
          'Natural Resources Wales',
          'packaging@naturalresourceswales.gov.uk'
        ],
        [
          'NorthernIreland',
          'Northern Ireland Environment Agency',
          'repandexp@daera-ni.gov.uk'
        ]
      ])(
        'shows the %s regulator name and email between the payment reference and the return home link',
        async (nation, regulatorName, regulatorEmail) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication({ nation })
          )
          const cookie = await getSessionCookieWithReference()

          const { result } = await server.inject({
            method: 'GET',
            url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
            headers: { Cookie: cookie }
          })

          expect(result).toContain('data-testid="contact-regulator-heading"')
          expect(result).toContain('data-testid="contact-regulator-details"')
          expect(result).toContain(regulatorName)
          expect(result).toContain(regulatorEmail)

          const referenceIndex = result.indexOf(
            'data-testid="bank-payment-reference"'
          )
          const contactIndex = result.indexOf(
            'data-testid="contact-regulator-heading"'
          )
          const returnHomeIndex = result.indexOf(
            'data-testid="return-home-link"'
          )
          expect(referenceIndex).toBeLessThan(contactIndex)
          expect(contactIndex).toBeLessThan(returnHomeIndex)
        }
      )
    })

    // RA-526: nation resolution no longer touches postcode - application.nation
    // (or the England default) is the only source now.
    test('exporter (no siteAddress) shows Scotland bank details when application.nation is Scotland', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          companyRegisterAddressPostcode: 'KW2 7LZ',
          nation: 'Scotland'
        })
      )
      const cookie = await getSessionCookieWithReference()

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
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
        headers: { Cookie: cookie }
      })

      expect(result).toContain('data-testid="how-long-payments-take"')
      expect(result).toContain('Bank transfers can take 3 to 5 working days')
      expect(result).not.toContain('govuk-details')
    })

    test('can be revisited — session is not cleared on render', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const firstResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
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
        headers: { Cookie: persistedCookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    // RA-000 (AC5): the submission succeeded, so the page still confirms it
    // with the application reference. Only the payment details become an
    // error: no payment reference, nothing in its place, and an Error log.
    describe('when the payment reference cannot be loaded', () => {
      async function getConfirmation() {
        const cookie = await getSessionCookieWithReference('RA-000000001')
        return server.inject({
          method: 'GET',
          url: `/accreditation/submit-confirmation/${APPLICATION_ID}`,
          headers: { Cookie: cookie }
        })
      }

      function expectSubmittedWithPaymentError({ statusCode, result }) {
        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="confirmation-panel"')
        expect(result).toContain(
          '<strong data-testid="application-reference">RA-000000001</strong>'
        )
        expect(result).toContain(
          '<p class="govuk-body govuk-error-message" data-testid="load-error">Sorry, we were unable to load the payment details. Please try again.</p>'
        )
        expect(result).not.toContain('data-testid="bank-payment-reference"')
        expect(result).not.toContain('data-testid="bank-details-list"')
        expect(result.match(/RA-000000001/g)).toHaveLength(1)
      }

      test.each([
        ['null', { paymentReference: null }],
        ['missing', { paymentReference: undefined }]
      ])(
        'confirms the submission, shows a payment details error and logs at Error when the reference is %s',
        async (_label, overrides) => {
          vi.spyOn(apiClient, 'get').mockResolvedValue(
            makeApplication(overrides)
          )
          const errorLog = vi.spyOn(server.logger, 'error')

          const response = await getConfirmation()

          expectSubmittedWithPaymentError(response)
          expect(response.result).toMatch(/Application reference for\s+Steel:/)
          expect(errorLog).toHaveBeenCalledWith(
            expect.objectContaining({
              applicationId: APPLICATION_ID,
              err: expect.objectContaining({
                message: 'Application has no payment reference'
              })
            }),
            `Error loading payment details ${APPLICATION_ID}`
          )
          expect(errorLog.mock.calls[0][0]).toHaveProperty('organisationId')
        }
      )

      test('confirms the submission without a material name, shows a payment details error and logs at Error when the application fetch fails', async () => {
        vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))
        const errorLog = vi.spyOn(server.logger, 'error')

        const response = await getConfirmation()

        expectSubmittedWithPaymentError(response)
        expect(response.result).toMatch(
          /data-testid="panel-body">\s*Application reference:/
        )
        expect(response.result).not.toContain('Application reference for')
        expect(errorLog).toHaveBeenCalledWith(
          expect.objectContaining({
            applicationId: APPLICATION_ID,
            err: expect.objectContaining({ message: 'API error' })
          }),
          `Error loading payment details ${APPLICATION_ID}`
        )
        expect(errorLog.mock.calls[0][0]).toHaveProperty('organisationId')
      })

      test('confirms the submission and shows a payment details error when the amount cannot be calculated', async () => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({ prns: { plannedTonnageBand: null } })
        )

        expectSubmittedWithPaymentError(await getConfirmation())
      })

      test('shows the error in Welsh on the Welsh route', async () => {
        vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API error'))
        const cookie = await getSessionCookieWithReference('RA-000000001')

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/cy/accreditation/submit-confirmation/${APPLICATION_ID}`,
          headers: { Cookie: cookie }
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('[Welsh] Application reference:')
        expect(result).toContain(
          '[Welsh] Sorry, we were unable to load the payment details. Please try again.'
        )
      })
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const cookie = await getSessionCookieWithReference()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/submit-confirmation/${APPLICATION_ID}`,
        headers: { Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Application submitted')
    })
  })
})
