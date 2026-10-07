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
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { setMultipleInterimSitesEnabled } from '../../../common/test-helpers/feature-flags.js'

const APPLICATION_ID = 'app-is-cya-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/check-your-answers`
const RECYCLING_OPERATION_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/recycling-operation-details`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) {
    return ''
  }
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

describe('#addInterimSiteCyaController', () => {
  let server
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const operatorHeaders = {
    'x-test-user-type': 'operator'
  }

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  // RA-486: the interim CYA GET now guards on linkedSiteId, so every test
  // needs a real session walked through the whole wizard (as an operator
  // would), rather than a bare cookie from an unauthenticated GET.
  beforeEach(async () => {
    vi.clearAllMocks()

    vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
      applicationId: APPLICATION_ID,
      organisationId: 'org-001',
      overseasSites: { sectionStatus: 'InProgress', sites: [] }
    })
    vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue({
      siteId: 555
    })

    const cyaEntryResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`,
      headers: postHeaders,
      payload: 'action=addInterimSite'
    })
    let sessionCookie = cookiesFrom(cyaEntryResponse)

    const countryResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-interim-site/${APPLICATION_ID}/country`,
      headers: { ...postHeaders, cookie: sessionCookie },
      payload: 'country=France'
    })
    sessionCookie = cookiesFrom(countryResponse) || sessionCookie

    const siteNameResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`,
      headers: { ...postHeaders, cookie: sessionCookie },
      payload: 'siteName=Interim+Depot'
    })
    sessionCookie = cookiesFrom(siteNameResponse) || sessionCookie

    const siteLocationResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`,
      headers: { ...postHeaders, cookie: sessionCookie },
      payload: 'addressLine1=Unit+1&townOrCity=Rotterdam'
    })
    sessionCookie = cookiesFrom(siteLocationResponse) || sessionCookie

    const contactDetailsResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-contact-details`,
      headers: { ...postHeaders, cookie: sessionCookie },
      payload:
        'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=%2B441234567890'
    })
    sessionCookie = cookiesFrom(contactDetailsResponse) || sessionCookie

    const recyclingOperationResponse = await server.inject({
      method: 'POST',
      url: RECYCLING_OPERATION_URL,
      headers: { ...postHeaders, cookie: sessionCookie },
      payload: 'recyclingOperationCodes=R12'
    })
    sessionCookie = cookiesFrom(recyclingOperationResponse) || sessionCookie

    cookie = sessionCookie
  })

  describe(`GET ${BASE_URL}`, () => {
    test('redirects to select-overseas-sites when there is no linked ORS site (direct navigation)', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('returns 200 with check your answers heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Check your answers')
    })

    test('renders summary list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="summary-list"')
    })

    test('renders country, site name, location, contact and recycling operation rows', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="row-country"')
      expect(result).toContain('data-testid="row-site-name"')
      expect(result).toContain('data-testid="row-location"')
      expect(result).toContain('data-testid="row-contact-name"')
      expect(result).toContain('data-testid="row-contact-email"')
      expect(result).toContain('data-testid="row-contact-phone"')
      expect(result).toContain('data-testid="row-recycling-operation"')
      expect(result).toContain('R12')
    })

    test('does not render a site number row when not yet known', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).not.toContain('data-testid="row-site-number"')
    })

    test('renders change links', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="change-country"')
      expect(result).toContain('data-testid="change-site-name"')
    })

    test('renders a back link to recycling-operation-details', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(RECYCLING_OPERATION_URL)
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Check your answers')
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects to select-overseas-sites when the application is locked (%s) and overseasSites is not Queried',
      async (applicationStatus) => {
        vi.spyOn(
          accreditationApiService,
          'getApplication'
        ).mockResolvedValueOnce({
          applicationId: APPLICATION_ID,
          organisationId: 'org-001',
          applicationStatus,
          overseasSites: { sectionStatus: 'Completed', sites: [] }
        })

        const { statusCode, headers } = await server.inject({
          method: 'GET',
          url: BASE_URL,
          headers: { ...operatorHeaders, cookie }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(SELECT_ORS_URL)
      }
    )
  })

  describe(`POST ${BASE_URL}`, () => {
    test('calls createInterimSite and redirects to select-overseas-sites on success', async () => {
      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue({
        siteId: 2,
        siteNumber: 'SN-001',
        isNewSite: true
      })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createInterimSite).toHaveBeenCalled()
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects to select-overseas-sites without creating the site when the application is locked (%s)',
      async (applicationStatus) => {
        vi.spyOn(
          accreditationApiService,
          'getApplication'
        ).mockResolvedValueOnce({
          applicationId: APPLICATION_ID,
          organisationId: 'org-001',
          applicationStatus,
          overseasSites: { sectionStatus: 'Completed', sites: [] }
        })
        const createSpy = vi
          .spyOn(accreditationApiService, 'createInterimSite')
          .mockResolvedValue({ siteId: 2 })

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: BASE_URL,
          headers: {
            ...operatorHeaders,
            'content-type': 'application/x-www-form-urlencoded',
            Cookie: cookie
          },
          payload: ''
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(SELECT_ORS_URL)
        expect(createSpy).not.toHaveBeenCalled()
      }
    )

    test('redirects to select-overseas-sites (not a raw error) when createInterimSite fails with a 409', async () => {
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(accreditationApiService, 'createInterimSite').mockRejectedValue(
        err
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    // The refused answers can never be saved, so they must not linger to
    // pre-fill the next "Add interim site": the CYA page has nothing to show.
    test('clears the wizard answers when the save is refused with a 409', async () => {
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(accreditationApiService, 'createInterimSite').mockRejectedValue(
        err
      )

      const refused = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          Cookie: cookiesFrom(refused) || cookie
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    // Multiple interim sites off: the create is held to one per ORS against a
    // fresh read, whichever page the operator came in from. 555 is the ORS the
    // session was linked to in beforeEach.
    test('with multiple interim sites off, refuses a create for an ORS that already has one', async () => {
      const flag = setMultipleInterimSitesEnabled(false)
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
        applicationId: APPLICATION_ID,
        organisationId: 'org-001',
        overseasSites: {
          sectionStatus: 'InProgress',
          sites: [{ siteId: 555, interimSites: [{ siteId: 42 }] }]
        }
      })
      const createSpy = vi
        .spyOn(accreditationApiService, 'createInterimSite')
        .mockResolvedValue({ siteId: 2 })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })
      flag.mockRestore()

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(createSpy).not.toHaveBeenCalled()
    })

    // RA-620: same diagnosability gap as the overseas site save.
    test('logs the fields the backend rejected when createInterimSite returns a 400', async () => {
      const err = Object.assign(new Error('API request failed: 400'), {
        status: 400,
        response: JSON.stringify([
          {
            propertyName: 'ContactPhone',
            errorMessage: 'ContactPhone must be a valid phone number.',
            attemptedValue: '+44 1234 5678 9012 3456',
            errorCode: 'RegularExpressionValidator'
          }
        ])
      })
      vi.spyOn(accreditationApiService, 'createInterimSite').mockRejectedValue(
        err
      )
      const errorLog = vi.spyOn(server.logger, 'error')

      await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      const [, message] = errorLog.mock.calls.find(([, text]) =>
        text.startsWith('Interim site CYA save error (createInterimSite)')
      )
      expect(message).toContain(
        'validation failed: ContactPhone (RegularExpressionValidator: ContactPhone must be a valid phone number.)'
      )
      expect(message).toContain('contactPhone: ')
      expect(message).not.toContain('+44 1234 5678 9012 3456')
    })

    test('renders error when API call fails', async () => {
      vi.spyOn(accreditationApiService, 'createInterimSite').mockRejectedValue(
        new Error('API error')
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  // RA-486: "Change" on an existing interim site re-enters this same wizard,
  // keyed by editingInterimSiteId instead of a fresh create. There is no
  // dedicated backend update endpoint for an interim site's own fields, so
  // this goes out via the bulk patchOverseasSites path instead of
  // createInterimSite, with the edited interimSite object keeping its
  // existing siteId (confirmed against the backend's merge behaviour).
  describe(`POST ${BASE_URL} — editing an existing interim site`, () => {
    const EXISTING_SITE = {
      siteId: 555,
      orsId: '001',
      siteName: 'ORS One',
      country: 'Netherlands',
      interimSite: {
        siteId: 42,
        siteNumber: 'SN-042',
        country: 'France',
        siteName: 'Interim Depot',
        addressLine1: 'Unit 1',
        townOrCity: 'Rotterdam',
        contactName: 'Jane Smith',
        contactEmail: 'jane@example.com',
        contactPhone: '+441234567890',
        operationCodes: ['R12'],
        isNewSite: false
      }
    }

    async function seedEditSession() {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
        applicationId: APPLICATION_ID,
        organisationId: 'org-001',
        overseasSites: { sectionStatus: 'InProgress', sites: [EXISTING_SITE] }
      })

      const entryResponse = await server.inject({
        method: 'GET',
        // RA-603: the edit route names the INTERIM site (42), not its parent
        // ORS (555). An ORS can hold several, so the parent no longer says
        // which one.
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/42`,
        headers: operatorHeaders
      })
      expect(entryResponse.statusCode).toBe(statusCodes.redirect)
      // RA-632: Change lands straight on this page.
      expect(entryResponse.headers.location).toBe(
        `/accreditation/add-interim-site/${APPLICATION_ID}/check-your-answers`
      )

      return cookiesFrom(entryResponse)
    }

    // RA-636
    test('back link returns to the ORS list', async () => {
      const sessionCookie = await seedEditSession()
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toMatch(
        new RegExp(
          `data-testid="back-link"[^>]*href="/accreditation/select-overseas-sites/${APPLICATION_ID}"|href="/accreditation/select-overseas-sites/${APPLICATION_ID}"[^>]*data-testid="back-link"`
        )
      )
    })

    // RA-603: an edit now goes through the interim site's own endpoint. It used
    // to rebuild the whole site list and send it back through the bulk PATCH,
    // which was a read-modify-write over every site and could not express
    // "change this one interim site" once an ORS could hold several.
    test('calls updateInterimSite (not createInterimSite or the bulk PATCH)', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockResolvedValue(
        {}
      )
      vi.spyOn(accreditationApiService, 'patchOverseasSites')
      vi.spyOn(accreditationApiService, 'createInterimSite')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createInterimSite).not.toHaveBeenCalled()
      expect(accreditationApiService.patchOverseasSites).not.toHaveBeenCalled()
      expect(accreditationApiService.updateInterimSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        555,
        42,
        expect.objectContaining({
          siteName: 'Interim Depot',
          country: 'France'
        })
      )
    })

    // siteNumber used to have to be echoed back by hand or the bulk PATCH would
    // wipe it. The backend owns it now and ignores it from the body, so the
    // request does not carry it at all - which is the point.
    test('does not send the server-owned identity fields', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockResolvedValue(
        {}
      )

      await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })

      const body =
        accreditationApiService.updateInterimSite.mock.calls[0]?.[4] ?? {}
      expect(body).not.toHaveProperty('siteId')
      expect(body).not.toHaveProperty('siteNumber')
      expect(body).not.toHaveProperty('removedAt')
    })

    // RA-486 regression: a stale editingInterimSiteId (e.g. an abandoned
    // Change carried into a create against a different ORS) must not PATCH
    // an interimSite onto a site that doesn't have one -- that would forge
    // a duplicate SiteId and a null SiteNumber. Falls back to the normal
    // create path, which is where the backend allocates both.
    test('falls back to createInterimSite when the interim site being edited is gone', async () => {
      const flag = setMultipleInterimSitesEnabled(true)
      const sessionCookie = await seedEditSession()

      // A stale editingInterimSiteId - an abandoned Change carried into a
      // create against a different ORS, or a site withdrawn in another tab.
      // The server says 404; surfacing that to the operator would be an error
      // they cannot act on, so it becomes a create instead.
      const notFound = Object.assign(new Error('not found'), { status: 404 })
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockRejectedValue(
        notFound
      )
      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue(
        {}
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createInterimSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        555,
        expect.objectContaining({ siteName: 'Interim Depot' })
      )
      flag.mockRestore()
    })

    // The fallback is a create, so with multiple interim sites off it is held
    // to one per ORS like any other: refused while the ORS still shows an
    // active interim site, allowed once it has none.
    test('with multiple interim sites off, refuses the fallback create while the ORS still has one', async () => {
      const flag = setMultipleInterimSitesEnabled(false)
      const sessionCookie = await seedEditSession()
      const notFound = Object.assign(new Error('not found'), { status: 404 })
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockRejectedValue(
        notFound
      )
      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue(
        {}
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })
      flag.mockRestore()

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createInterimSite).not.toHaveBeenCalled()
    })

    test('with multiple interim sites off, allows the fallback create once the ORS has none', async () => {
      const flag = setMultipleInterimSitesEnabled(false)
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
        applicationId: APPLICATION_ID,
        organisationId: 'org-001',
        overseasSites: {
          sectionStatus: 'InProgress',
          sites: [{ ...EXISTING_SITE, interimSite: null }]
        }
      })
      const notFound = Object.assign(new Error('not found'), { status: 404 })
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockRejectedValue(
        notFound
      )
      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue(
        {}
      )

      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })
      flag.mockRestore()

      expect(statusCode).toBe(statusCodes.redirect)
      expect(accreditationApiService.createInterimSite).toHaveBeenCalled()
    })

    // RA-620: an edit's 400 is logged under the call that actually failed,
    // with the backend's failing fields and none of the submitted values.
    test('logs updateInterimSite and the fields the backend rejected when an edit returns a 400', async () => {
      const sessionCookie = await seedEditSession()
      const err = Object.assign(new Error('API request failed: 400'), {
        status: 400,
        response: JSON.stringify([
          {
            propertyName: 'Postcode',
            errorMessage:
              "The length of 'Postcode' must be 20 characters or fewer. You entered 21 characters.",
            attemptedValue: 'SW1A 1AA SW1A 1AA 999',
            errorCode: 'MaximumLengthValidator'
          }
        ])
      })
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockRejectedValue(
        err
      )
      vi.spyOn(accreditationApiService, 'createInterimSite')
      const errorLog = vi.spyOn(server.logger, 'error')

      await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })

      const [, message] = errorLog.mock.calls.find(([, text]) =>
        text.startsWith('Interim site CYA save error (updateInterimSite)')
      )
      expect(message).toContain(
        'validation failed: Postcode (MaximumLengthValidator:'
      )
      expect(message).not.toContain('SW1A 1AA SW1A 1AA 999')
      expect(accreditationApiService.createInterimSite).not.toHaveBeenCalled()
    })

    // Only a 404 means "it is not there any more". Anything else is a real
    // failure and must not be quietly turned into a second interim site.
    test('does not create a duplicate when the update fails for any other reason', async () => {
      const sessionCookie = await seedEditSession()

      const conflict = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(accreditationApiService, 'updateInterimSite').mockRejectedValue(
        conflict
      )
      vi.spyOn(accreditationApiService, 'createInterimSite')

      await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie: sessionCookie },
        payload: ''
      })

      expect(accreditationApiService.createInterimSite).not.toHaveBeenCalled()
    })
  })
})
