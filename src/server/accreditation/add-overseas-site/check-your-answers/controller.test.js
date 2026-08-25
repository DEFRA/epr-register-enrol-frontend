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

const APPLICATION_ID = 'app-cya-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function makeApplication(sites = []) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'org-001',
    overseasSites: { sectionStatus: 'InProgress', sites }
  }
}

describe('#addOrsCyaController', () => {
  let server
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    vi.clearAllMocks()

    const res = await server.inject({
      method: 'GET',
      url: BASE_URL,
      headers: {
        'x-test-user-type': 'operator'
      }
    })
    const setCookie = res.headers['set-cookie']
    cookie = Array.isArray(setCookie)
      ? setCookie[0].split(';')[0]
      : (setCookie ?? '').split(';')[0]
  })

  const operatorHeaders = {
    'x-test-user-type': 'operator'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with check your answers heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Check your answers')
    })

    test('renders summary list', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="summary-list"')
    })

    test('renders site name row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-site-name"')
      expect(result).toContain('Site name')
    })

    test('renders contact name row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-contact-name"')
    })

    test('renders repatriated loads row', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="row-repatriated-loads"')
    })

    test('renders change links', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="change-site-name"')
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Check your answers')
    })

    test('renders a single Basel row listing all entered codes', async () => {
      const baselCodePostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload: 'action=continue&visibleCount=2&code-0=A1181&code-1=GC030'
      })
      const sessionCookie = baselCodePostResponse.headers['set-cookie']
        ? (Array.isArray(baselCodePostResponse.headers['set-cookie'])
            ? baselCodePostResponse.headers['set-cookie'][0]
            : baselCodePostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="row-basel-codes"')
      expect(result).toContain('Basel Convention codes')
      expect(result).toContain('A1181')
      expect(result).toContain('GC030')
      expect(result).toContain('data-testid="delete-code-0"')
      expect(result).toContain('data-testid="delete-code-1"')
    })

    test('shows "None entered" when no codes were added', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="row-basel-codes"')
      expect(result).toContain('None entered')
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to select-overseas-sites on success', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([{ siteId: 1, orsId: '001' }])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
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

    // RA-482: orsId is generated server-side now -- the frontend must not compute or send one,
    // and no longer needs to fetch the application first to work one out.
    test('does not include orsId on the create-site payload, and does not fetch the application', async () => {
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2, orsId: '002' }
      )

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

      expect(accreditationApiService.createOverseasSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        expect.not.objectContaining({ orsId: expect.anything() })
      )
      expect(accreditationApiService.getApplication).not.toHaveBeenCalled()
    })

    test('renders error when API call fails', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockRejectedValue(
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

    test('maps entered codes onto code1/code2/code3 for the backend, filling gaps with null', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
      )

      const baselCodePostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload: 'action=continue&visibleCount=2&code-0=A1181&code-1=GC050'
      })
      const sessionCookie = baselCodePostResponse.headers['set-cookie']
        ? (Array.isArray(baselCodePostResponse.headers['set-cookie'])
            ? baselCodePostResponse.headers['set-cookie'][0]
            : baselCodePostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createOverseasSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        expect.objectContaining({
          code1: 'A1181',
          code2: 'GC050',
          code3: null
        })
      )
    })

    test('sends the selected R-codes as operationCodes on the payload', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
      )

      const rodPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload: 'recyclingOperationCodes=R3&recyclingOperationCodes=R12'
      })
      const sessionCookie = rodPostResponse.headers['set-cookie']
        ? (Array.isArray(rodPostResponse.headers['set-cookie'])
            ? rodPostResponse.headers['set-cookie'][0]
            : rodPostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'action=addInterimSite'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(accreditationApiService.createOverseasSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        expect.objectContaining({ operationCodes: ['R3', 'R12'] })
      )
    })

    test('explicit action=confirm redirects to select-overseas-sites (same as default)', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'action=confirm'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })
  })

  describe('AC08 — R12/R13 require an interim site', () => {
    async function seedCodesSession(...codes) {
      const payload = codes.map((c) => `recyclingOperationCodes=${c}`).join('&')
      const response = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload
      })
      const raw = response.headers['set-cookie']
      if (!raw) {
        return cookie
      }
      return (Array.isArray(raw) ? raw[0] : raw).split(';')[0]
    }

    test('GET renders only Add Interim Site when R12 is selected', async () => {
      const sessionCookie = await seedCodesSession('R3', 'R12')

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).not.toContain('data-testid="submit-button"')
      expect(result).toContain('data-testid="save-and-add-interim-site-button"')
    })

    test('GET renders only Add Interim Site when R13 is selected', async () => {
      const sessionCookie = await seedCodesSession('R4', 'R13')

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).not.toContain('data-testid="submit-button"')
    })

    test('GET renders both buttons when neither R12 nor R13 is selected', async () => {
      const sessionCookie = await seedCodesSession('R3')

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="submit-button"')
      expect(result).toContain('data-testid="save-and-add-interim-site-button"')
    })

    test('POST action=confirm with R12 present does not create the site', async () => {
      const sessionCookie = await seedCodesSession('R3', 'R12')
      vi.spyOn(accreditationApiService, 'createOverseasSite')

      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'action=confirm'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(accreditationApiService.createOverseasSite).not.toHaveBeenCalled()
    })

    test('POST with no action (default) and R13 present does not create the site', async () => {
      const sessionCookie = await seedCodesSession('R4', 'R13')
      vi.spyOn(accreditationApiService, 'createOverseasSite')

      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(accreditationApiService.createOverseasSite).not.toHaveBeenCalled()
    })

    test('POST action=addInterimSite with R12 present still proceeds', async () => {
      const sessionCookie = await seedCodesSession('R3', 'R12')
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 2 }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'action=addInterimSite'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/add-interim-site/${APPLICATION_ID}/country`
      )
      expect(accreditationApiService.createOverseasSite).toHaveBeenCalled()
    })
  })

  describe(`POST ${BASE_URL} — action=deleteBaselCode branch`, () => {
    test('removes the code at codeIndex and stays on the CYA page', async () => {
      const baselCodePostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload:
          'action=continue&visibleCount=3&code-0=A1181&code-1=GC050&code-2=B3011'
      })
      const sessionCookie = baselCodePostResponse.headers['set-cookie']
        ? (Array.isArray(baselCodePostResponse.headers['set-cookie'])
            ? baselCodePostResponse.headers['set-cookie'][0]
            : baselCodePostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const deleteResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'action=deleteBaselCode-1'
      })

      expect(deleteResponse.statusCode).toBe(statusCodes.redirect)
      expect(deleteResponse.headers.location).toBe(BASE_URL)

      const postDeleteCookie = deleteResponse.headers['set-cookie']
        ? (Array.isArray(deleteResponse.headers['set-cookie'])
            ? deleteResponse.headers['set-cookie'][0]
            : deleteResponse.headers['set-cookie']
          ).split(';')[0]
        : sessionCookie

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: postDeleteCookie }
      })

      expect(result).toContain('A1181')
      expect(result).toContain('B3011')
      expect(result).not.toContain('GC050')
    })
  })

  describe(`POST ${BASE_URL} — action=addInterimSite branch`, () => {
    const ADD_INTERIM_SITE_COUNTRY_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/country`

    function cookieHeaderFrom(response, fallback) {
      const raw = response.headers['set-cookie']
      if (!raw) {
        return fallback
      }
      return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
    }

    test('redirects to add-interim-site country step instead of select-overseas-sites', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 555123 }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'action=addInterimSite'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(ADD_INTERIM_SITE_COUNTRY_URL)
    })

    test('still returns 500 with error summary when createOverseasSite fails, regardless of action', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockRejectedValue(
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
        payload: 'action=addInterimSite'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('stashes the created site siteId as linkedSiteId, consumed by the interim-site CYA on submit', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue(
        { siteId: 777888 }
      )

      const orsCyaPostResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          Cookie: cookie
        },
        payload: 'action=addInterimSite'
      })
      expect(orsCyaPostResponse.statusCode).toBe(statusCodes.redirect)
      expect(orsCyaPostResponse.headers.location).toBe(
        ADD_INTERIM_SITE_COUNTRY_URL
      )

      let sessionCookie = cookieHeaderFrom(orsCyaPostResponse, cookie)

      const countryPostResponse = await server.inject({
        method: 'POST',
        url: ADD_INTERIM_SITE_COUNTRY_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'country=France'
      })
      expect(countryPostResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(countryPostResponse, sessionCookie)

      const siteNamePostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'siteName=Interim+Depot'
      })
      expect(siteNamePostResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(siteNamePostResponse, sessionCookie)

      const siteLocationPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'addressLine1=Unit+1&townOrCity=Rotterdam'
      })
      expect(siteLocationPostResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(siteLocationPostResponse, sessionCookie)

      const contactDetailsPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-contact-details`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload:
          'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=%2B441234567890'
      })
      expect(contactDetailsPostResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(
        contactDetailsPostResponse,
        sessionCookie
      )

      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue({
        siteId: 1,
        siteNumber: 'SN-001',
        isNewSite: true
      })

      const interimCyaPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/check-your-answers`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      expect(interimCyaPostResponse.statusCode).toBe(statusCodes.redirect)
      expect(interimCyaPostResponse.headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createInterimSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        777888,
        expect.objectContaining({
          country: 'France',
          siteName: 'Interim Depot',
          contactName: 'Jane Smith',
          contactEmail: 'jane@example.com',
          contactPhone: '+441234567890'
        })
      )
    })
  })

  describe('POST — arriving via the promote (Add To Accreditation) entry point', () => {
    const PROMOTE_ENTRY_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`

    function cookieHeaderFrom(response, fallback) {
      const raw = response.headers['set-cookie']
      if (!raw) {
        return fallback
      }
      return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
    }

    const REGISTERED_SITE = {
      siteId: 900002,
      orsId: '002',
      siteName: 'Registered Site',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      country: 'Netherlands',
      contactName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      operationCodes: ['R3'],
      code1: 'A1181',
      repatriatedLoads: 'Details',
      selected: false
    }

    async function seedPromoteSession() {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([REGISTERED_SITE])
      )
      const entryResponse = await server.inject({
        method: 'GET',
        url: PROMOTE_ENTRY_URL,
        headers: operatorHeaders
      })
      expect(entryResponse.statusCode).toBe(statusCodes.redirect)
      expect(entryResponse.headers.location).toBe(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
      )
      return cookieHeaderFrom(entryResponse, cookie)
    }

    test('calls promoteOverseasSite instead of createOverseasSite, keyed on the original siteId', async () => {
      const sessionCookie = await seedPromoteSession()
      vi.spyOn(
        accreditationApiService,
        'promoteOverseasSite'
      ).mockResolvedValue({ siteId: 900002 })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.promoteOverseasSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        900002,
        expect.objectContaining({ siteName: 'Registered Site' })
      )
      expect(accreditationApiService.createOverseasSite).not.toHaveBeenCalled()
    })

    test('returns 500 with error summary when promoteOverseasSite fails', async () => {
      const sessionCookie = await seedPromoteSession()
      vi.spyOn(
        accreditationApiService,
        'promoteOverseasSite'
      ).mockRejectedValue(new Error('promote failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
