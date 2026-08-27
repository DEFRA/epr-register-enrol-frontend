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
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/555`,
        headers: operatorHeaders
      })
      expect(entryResponse.statusCode).toBe(statusCodes.redirect)
      expect(entryResponse.headers.location).toBe(
        `/accreditation/add-interim-site/${APPLICATION_ID}/country`
      )

      return cookiesFrom(entryResponse)
    }

    test('calls patchOverseasSites (not createInterimSite) keeping the existing interim site id', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'patchOverseasSites').mockResolvedValue(
        {}
      )
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
      expect(accreditationApiService.patchOverseasSites).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        {
          sites: [
            expect.objectContaining({
              siteId: 555,
              interimSite: expect.objectContaining({
                siteId: 42,
                siteName: 'Interim Depot',
                country: 'France'
              })
            })
          ]
        }
      )
    })
  })
})
