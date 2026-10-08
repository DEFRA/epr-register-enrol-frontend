import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
  afterEach
} from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { setMultipleInterimSitesEnabled } from '../../../common/test-helpers/feature-flags.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  addOrsCyaGetController,
  addOrsCyaPostController
} from './controller.js'

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

// Scopes an assertion to a single summary-list row, since several rows share
// the same "empty" markup (`<dd class="govuk-summary-list__value"></dd>`)
// and a plain `result.toContain(...)` check can't tell them apart.
function extractRowHtml(html, testId) {
  const match = html.match(
    new RegExp(`data-testid="row-${testId}"[\\s\\S]*?</div>`)
  )
  return match ? match[0] : ''
}

const FORM = 'application/x-www-form-urlencoded'

// Every answer a fresh add of a Plastic/Glass-style site needs, one wizard step
// per entry, in the order the wizard asks for them.
const COMPLETE_ANSWERS = [
  ['site-name', 'siteName=Acme+Recyclers+GmbH'],
  [
    'site-location',
    'addressLine1=Unit+1&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C+4.4792'
  ],
  [
    'site-contact-details',
    'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com&siteContactPhone=%2B441234567890'
  ],
  ['recycling-operation-details', 'recyclingOperationCodes=R3'],
  [
    'basel-convention-and-oecd-code',
    'action=continue&visibleCount=1&code-0=A1181'
  ],
  ['repatriated-loads', 'repatriatedLoads=Returned+within+30+days']
]

describe('#addOrsCyaController', () => {
  let server
  let cookie
  let emptyCookie

  // Walks the wizard steps with valid answers so the session holds everything
  // check-your-answers now requires before it will save a site.
  async function completeSession(startCookie) {
    let sessionCookie = startCookie
    for (const [step, payload] of COMPLETE_ANSWERS) {
      const response = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/${step}`,
        headers: {
          'x-test-user-type': 'operator',
          'content-type': FORM,
          cookie: sessionCookie
        },
        payload
      })
      const raw = response.headers['set-cookie']
      if (raw) {
        sessionCookie = (Array.isArray(raw) ? raw[0] : raw).split(';')[0]
      }
    }
    return sessionCookie
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    // Restored, not just cleared: the session below is built by posting the
    // wizard steps, and a lingering "locked application" mock from the
    // previous test would make every one of those posts redirect unsaved.
    vi.restoreAllMocks()

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
    emptyCookie = cookie
    cookie = await completeSession(emptyCookie)
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

    test('renders a back link to repatriated-loads (last step for materials without conditions-of-export)', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/repatriated-loads`
      )
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

    test('renders coordinates row with the value entered on site-location', async () => {
      const siteLocationPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/site-location`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload:
          'addressLine1=Unit+1&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C+4.4792'
      })
      const sessionCookie = siteLocationPostResponse.headers['set-cookie']
        ? (Array.isArray(siteLocationPostResponse.headers['set-cookie'])
            ? siteLocationPostResponse.headers['set-cookie'][0]
            : siteLocationPostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="row-coordinates"')
      expect(result).toContain('Coordinates')
      expect(result).toContain('51.9225, 4.4792')
      expect(result).toContain('data-testid="change-coordinates"')
    })

    test('shows "None entered" when no codes were added', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: emptyCookie }
      })

      expect(result).toContain('data-testid="row-basel-codes"')
      expect(result).toContain('None entered')
    })

    test.each([
      'site-name',
      'location',
      'coordinates',
      'contact-name',
      'contact-email',
      'contact-phone',
      'recycling-operation',
      'repatriated-loads'
    ])(
      'says "Not provided" for the %s row when nothing has been entered',
      async (testId) => {
        const { result } = await server.inject({
          method: 'GET',
          url: BASE_URL,
          headers: { ...operatorHeaders, cookie: emptyCookie }
        })

        expect(extractRowHtml(result, testId)).toContain(
          `data-testid="not-provided-${testId}"`
        )
        expect(extractRowHtml(result, testId)).toContain('Not provided')
      }
    )

    test('omits the conditions-of-export row entirely when it is unset', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).not.toContain('data-testid="row-conditions-of-export"')
    })

    test('renders the conditions-of-export row once it has been answered', async () => {
      const conditionsOfExportPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/conditions-of-export`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie
        },
        payload: 'conditionsOfExport=yes'
      })
      const sessionCookie = conditionsOfExportPostResponse.headers['set-cookie']
        ? (Array.isArray(conditionsOfExportPostResponse.headers['set-cookie'])
            ? conditionsOfExportPostResponse.headers['set-cookie'][0]
            : conditionsOfExportPostResponse.headers['set-cookie']
          ).split(';')[0]
        : cookie

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(extractRowHtml(result, 'conditions-of-export')).toContain('Yes')
      expect(result).toContain('data-testid="change-conditions-of-export"')
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects to select-overseas-sites when the application is locked (%s) and overseasSites is not Queried',
      async (applicationStatus) => {
        vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
          ...makeApplication([]),
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

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects to select-overseas-sites without creating the site when the application is locked (%s)',
      async (applicationStatus) => {
        vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
          ...makeApplication([{ siteId: 1, orsId: '001' }]),
          applicationStatus,
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ siteId: 1, orsId: '001' }]
          }
        })
        const createSpy = vi
          .spyOn(accreditationApiService, 'createOverseasSite')
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

    // RA-482: orsId is generated server-side now -- the frontend must not compute or send one.
    // (RA-481's guard now fetches the application on every write to check lock status, so
    // unlike before RA-481 existed, getApplication IS expected to be called here.)
    test('does not include orsId on the create-site payload', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([{ siteId: 1, orsId: '001' }])
      )
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

    test('renders error when the application fetch itself fails', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockRejectedValue(
        new Error('network error')
      )
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockRejectedValue(
        new Error('network error')
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

    test('redirects to select-overseas-sites (not a raw error) when createOverseasSite fails with a 409', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([])
      )
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(accreditationApiService, 'createOverseasSite').mockRejectedValue(
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

  describe('RA-486 — Add this site and Add an interim site are independent of R12/R13', () => {
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

    test('GET always renders both buttons when R12 is selected', async () => {
      const sessionCookie = await seedCodesSession('R3', 'R12')

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="submit-button"')
      expect(result).toContain('data-testid="save-and-add-interim-site-button"')
    })

    test('GET always renders both buttons when R13 is selected', async () => {
      const sessionCookie = await seedCodesSession('R4', 'R13')

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="submit-button"')
      expect(result).toContain('data-testid="save-and-add-interim-site-button"')
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

    test('POST action=confirm with R12 present still creates the site (no longer forced into the interim path)', async () => {
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
        payload: 'action=confirm'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createOverseasSite).toHaveBeenCalled()
    })

    test('POST with no action (default) and R13 present still creates the site', async () => {
      const sessionCookie = await seedCodesSession('R4', 'R13')
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
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(accreditationApiService.createOverseasSite).toHaveBeenCalled()
    })

    test('POST action=addInterimSite with no R12/R13 present still proceeds (interim site is independent now)', async () => {
      const sessionCookie = await seedCodesSession('R3')
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
      coordinates: '51.9225, 4.4792',
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
        `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
      )
      return cookieHeaderFrom(entryResponse, cookie)
    }

    // RA-636: Back on check-your-answers returns to the ORS list, not the last
    // wizard step.
    test('back link returns to the ORS list', async () => {
      const sessionCookie = await seedPromoteSession()
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

    test('calls promoteOverseasSite instead of createOverseasSite, keyed on the original siteId', async () => {
      const sessionCookie = await seedPromoteSession()
      vi.spyOn(accreditationApiService, 'createOverseasSite')
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

    // RA-620: the two production 400s from promoteOverseasSite logged only
    // "API request failed: 400 Bad Request", so nobody could tell which field
    // the backend refused.
    test('logs the fields the backend rejected, and the payload shape, without any submitted values', async () => {
      const sessionCookie = await seedPromoteSession()
      const attemptedPhone = '+44 (0)20 7946 0000 9876 543210'
      const err = new Error('API request failed: 400 Bad Request')
      err.status = statusCodes.badRequest
      err.response = JSON.stringify([
        {
          propertyName: 'ContactPhone',
          errorMessage:
            "The length of 'Contact Phone' must be 30 characters or fewer. You entered 31 characters.",
          attemptedValue: attemptedPhone,
          errorCode: 'MaximumLengthValidator'
        }
      ])
      vi.spyOn(
        accreditationApiService,
        'promoteOverseasSite'
      ).mockRejectedValue(err)
      const errorLog = vi.spyOn(server.logger, 'error')

      await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })

      const [, message] = errorLog.mock.calls.find(([, text]) =>
        text.startsWith('CYA site save error (promoteOverseasSite)')
      )
      expect(message).toContain(
        "validation failed: ContactPhone (MaximumLengthValidator: The length of 'Contact Phone' must be 30 characters or fewer. You entered 31 characters.)"
      )
      expect(message).toContain('siteName: 15 chars')
      expect(message).toContain('contactEmail: 16 chars')
      expect(message).toContain('code2: null')
      expect(message).toContain('operationCodes: 1 items')
      expect(message).not.toContain(attemptedPhone)
      expect(message).not.toContain('jane@example.com')
      expect(message).not.toContain('Registered Site')
    })
  })

  describe('POST — arriving via the edit (Change) entry point', () => {
    const EDIT_ENTRY_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`

    function cookieHeaderFrom(response, fallback) {
      const raw = response.headers['set-cookie']
      if (!raw) {
        return fallback
      }
      return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
    }

    const ACCREDITED_SITE = {
      siteId: 900001,
      orsId: '001',
      siteName: 'Accredited Site',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      country: 'Netherlands',
      coordinates: '51.9225, 4.4792',
      contactName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      operationCodes: ['R3'],
      code1: 'A1181',
      repatriatedLoads: 'Details',
      selected: true
    }

    async function seedEditSession(site = ACCREDITED_SITE) {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([site])
      )
      const entryResponse = await server.inject({
        method: 'GET',
        url: EDIT_ENTRY_URL,
        headers: operatorHeaders
      })
      expect(entryResponse.statusCode).toBe(statusCodes.redirect)
      expect(entryResponse.headers.location).toBe(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
      )
      return cookieHeaderFrom(entryResponse, cookie)
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

    test('calls updateOverseasSite instead of createOverseasSite/promoteOverseasSite, keyed on the original siteId', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'createOverseasSite')
      vi.spyOn(accreditationApiService, 'promoteOverseasSite')
      vi.spyOn(accreditationApiService, 'updateOverseasSite').mockResolvedValue(
        { siteId: 900001 }
      )

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
      expect(accreditationApiService.updateOverseasSite).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        900001,
        expect.objectContaining({ siteName: 'Accredited Site' })
      )
      expect(accreditationApiService.createOverseasSite).not.toHaveBeenCalled()
      expect(accreditationApiService.promoteOverseasSite).not.toHaveBeenCalled()
    })

    // RA-603, multiple interim sites off: an ORS may hold one interim site, so
    // "Save and add interim site" is offered only while it has none.
    describe('with multiple interim sites off', () => {
      const SITE_WITH_INTERIM = {
        ...ACCREDITED_SITE,
        interimSite: { siteId: 42, siteName: 'Interim Depot' }
      }
      let flag
      beforeEach(() => {
        flag = setMultipleInterimSitesEnabled(false)
      })
      afterEach(() => {
        flag.mockRestore()
      })

      test('does not offer "Save and add interim site" for an ORS that already has one', async () => {
        const sessionCookie = await seedEditSession(SITE_WITH_INTERIM)

        const { result } = await server.inject({
          method: 'GET',
          url: BASE_URL,
          headers: { ...operatorHeaders, cookie: sessionCookie }
        })

        expect(result).not.toContain(
          'data-testid="save-and-add-interim-site-button"'
        )
        expect(result).toContain('data-testid="submit-button"')
      })

      test('still offers it for an ORS with no interim site', async () => {
        const sessionCookie = await seedEditSession()

        const { result } = await server.inject({
          method: 'GET',
          url: BASE_URL,
          headers: { ...operatorHeaders, cookie: sessionCookie }
        })

        expect(result).toContain(
          'data-testid="save-and-add-interim-site-button"'
        )
      })

      // A page rendered before the ORS got its interim site can still post the
      // action; it saves the ORS like Confirm instead of opening the wizard.
      test('saves and returns to the list when the action is posted anyway', async () => {
        const sessionCookie = await seedEditSession(SITE_WITH_INTERIM)
        vi.spyOn(
          accreditationApiService,
          'updateOverseasSite'
        ).mockResolvedValue({ siteId: 900001 })

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
        expect(headers.location).toBe(SELECT_ORS_URL)
        expect(accreditationApiService.updateOverseasSite).toHaveBeenCalled()
      })
    })

    test('returns 500 with error summary when updateOverseasSite fails', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'updateOverseasSite').mockRejectedValue(
        new Error('update failed')
      )

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

    test('flashes the edit success banner, rendered back on select-overseas-sites', async () => {
      const sessionCookie = await seedEditSession()
      vi.spyOn(accreditationApiService, 'updateOverseasSite').mockResolvedValue(
        { siteId: 900001 }
      )

      const cyaPostResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })
      expect(cyaPostResponse.statusCode).toBe(statusCodes.redirect)
      const selectOrsCookie = cookieHeaderFrom(cyaPostResponse, sessionCookie)

      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([ACCREDITED_SITE])
      )

      const { result } = await server.inject({
        method: 'GET',
        url: SELECT_ORS_URL,
        headers: { ...operatorHeaders, cookie: selectOrsCookie }
      })

      expect(result).toContain('data-testid="ors-edit-success-banner"')
    })

    // The edit-entry tests above all seed the session via seedEditSession() (one GET, then
    // straight to CYA) and never drive an individual step's own POST handler in edit mode --
    // including recycling-operation-details, the step CI's own E2E run reported as stalling on
    // this story. Walk the real step chain instead, submitting the site's already-selected
    // recycling operation code back through recycling-operation-details exactly as an edit
    // replay does, to prove a regression in any one step's redirect fails this suite too.
    test('walks the full edit-mode step chain (site-name through repatriated-loads) and reaches check-your-answers', async () => {
      const sessionCookie = await seedEditSession()
      const stepUrl = (step) =>
        `/accreditation/add-overseas-site/${APPLICATION_ID}/${step}`
      const postStep = (step, payload) =>
        server.inject({
          method: 'POST',
          url: stepUrl(step),
          headers: {
            ...operatorHeaders,
            'content-type': 'application/x-www-form-urlencoded',
            cookie: sessionCookie
          },
          payload
        })

      const siteNameResponse = await postStep(
        'site-name',
        'siteName=Accredited Site'
      )
      expect(siteNameResponse.statusCode).toBe(statusCodes.redirect)
      expect(siteNameResponse.headers.location).toBe(stepUrl('site-location'))

      const siteLocationResponse = await postStep(
        'site-location',
        'addressLine1=Unit+1&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C+4.4792'
      )
      expect(siteLocationResponse.statusCode).toBe(statusCodes.redirect)
      expect(siteLocationResponse.headers.location).toBe(
        stepUrl('site-contact-details')
      )

      const contactDetailsResponse = await postStep(
        'site-contact-details',
        'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com'
      )
      expect(contactDetailsResponse.statusCode).toBe(statusCodes.redirect)
      expect(contactDetailsResponse.headers.location).toBe(
        stepUrl('recycling-operation-details')
      )

      // ACCREDITED_SITE's own operationCodes (['R3']) is what edit-entry pre-populates the
      // session with -- submitting that same code back is exactly what a real edit replay
      // does, whether via a checkbox that was already checked or (as here) an explicit repost.
      const recyclingOperationResponse = await postStep(
        'recycling-operation-details',
        'recyclingOperationCodes=R3'
      )
      expect(recyclingOperationResponse.statusCode).toBe(statusCodes.redirect)
      expect(recyclingOperationResponse.headers.location).toBe(
        stepUrl('basel-convention-and-oecd-code')
      )

      const baselCodesResponse = await postStep(
        'basel-convention-and-oecd-code',
        'visibleCount=1&code-0=A1181'
      )
      expect(baselCodesResponse.statusCode).toBe(statusCodes.redirect)
      expect(baselCodesResponse.headers.location).toBe(
        stepUrl('repatriated-loads')
      )

      const repatriatedLoadsResponse = await postStep(
        'repatriated-loads',
        'repatriatedLoads=Details'
      )
      expect(repatriatedLoadsResponse.statusCode).toBe(statusCodes.redirect)
      expect(repatriatedLoadsResponse.headers.location).toBe(
        stepUrl('check-your-answers')
      )

      const cyaGetResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })
      expect(cyaGetResponse.statusCode).toBe(statusCodes.ok)
      expect(cyaGetResponse.result).toContain('Accredited Site')
    })
  })
})

// A site must be complete before it is saved, wherever its answers came from:
// the operator typing them in, or Re/Ex via the site list. Every message is the
// wizard step's own, so the operator sees the same wording on either path.
describe('#addOrsCyaController — completeness gate', () => {
  let server
  let emptyCookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    const res = await server.inject({
      method: 'GET',
      url: BASE_URL,
      headers: { 'x-test-user-type': 'operator' }
    })
    const raw = res.headers['set-cookie']
    emptyCookie = (Array.isArray(raw) ? raw[0] : (raw ?? '')).split(';')[0]
  })

  const operatorHeaders = { 'x-test-user-type': 'operator' }
  const postHeaders = (cookie) => ({
    ...operatorHeaders,
    'content-type': FORM,
    cookie
  })
  const fromCya = '?from=check-your-answers'
  const stepUrl = (step) =>
    `/accreditation/add-overseas-site/${APPLICATION_ID}/${step}`

  const EVERYTHING_MISSING = [
    'Enter the site name',
    'Enter address line 1',
    'Enter the town or city',
    'Select a country',
    'Enter the coordinates',
    'Enter the contact name',
    'Enter the email address',
    'Select at least one recycling operation',
    'Enter at least one Basel Convention or OECD code',
    'Describe the arrangements for loads that are rejected or returned to the UK'
  ]

  function summaryLinks(html) {
    return [
      ...html.matchAll(
        /<a href="([^"]+)" data-testid="error-summary-link-\d+">([^<]+)<\/a>/g
      )
    ].map(([, href, message]) => ({ href, message }))
  }

  describe('a session with nothing in it', () => {
    test('is refused with an error summary naming every missing answer, and nothing is saved', async () => {
      const createSpy = vi.spyOn(accreditationApiService, 'createOverseasSite')

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(emptyCookie),
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(createSpy).not.toHaveBeenCalled()
      expect(result).toContain('data-testid="error-summary"')
      expect(summaryLinks(result).map(({ message }) => message)).toEqual(
        EVERYTHING_MISSING
      )
    })

    test('each summary entry links to the step that fixes it, and Back from there returns here', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(emptyCookie),
        payload: ''
      })

      const hrefs = summaryLinks(result).map(({ href }) => href)
      expect(new Set(hrefs)).toEqual(
        new Set([
          `${stepUrl('site-name')}${fromCya}`,
          `${stepUrl('site-location')}${fromCya}`,
          `${stepUrl('site-contact-details')}${fromCya}`,
          `${stepUrl('recycling-operation-details')}${fromCya}`,
          `${stepUrl('basel-convention-and-oecd-code')}${fromCya}`,
          `${stepUrl('repatriated-loads')}${fromCya}`
        ])
      )
    })

    test('shows the error against the row it belongs to, as well as in the summary', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(emptyCookie),
        payload: ''
      })

      expect(extractRowHtml(result, 'contact-name')).toContain(
        'data-testid="error-contact-name"'
      )
      expect(extractRowHtml(result, 'contact-name')).toContain(
        'Enter the contact name'
      )
      expect(extractRowHtml(result, 'coordinates')).toContain(
        'Enter the coordinates'
      )
    })

    test('does not flag the optional phone number', async () => {
      const { result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(emptyCookie),
        payload: ''
      })

      expect(extractRowHtml(result, 'contact-phone')).not.toContain(
        'data-testid="error-contact-phone"'
      )
    })

    test.each(['confirm', 'addInterimSite'])(
      'applies to the %s action too, because both save the site',
      async (action) => {
        const createSpy = vi.spyOn(
          accreditationApiService,
          'createOverseasSite'
        )

        const { statusCode } = await server.inject({
          method: 'POST',
          url: BASE_URL,
          headers: postHeaders(emptyCookie),
          payload: `action=${action}`
        })

        expect(statusCode).toBe(statusCodes.badRequest)
        expect(createSpy).not.toHaveBeenCalled()
      }
    )
  })

  describe('a site brought in from Re/Ex with gaps', () => {
    const PROMOTE_ENTRY_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`
    const EDIT_ENTRY_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`

    // What Re/Ex supplies: a name and an address, but no coordinates, contact
    // or export details.
    const REEX_SITE = {
      siteId: 900002,
      orsId: '002',
      siteName: 'Re/Ex Site',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      country: 'Netherlands',
      selected: false
    }

    function sessionCookieFrom(response, fallback) {
      const raw = response.headers['set-cookie']
      return raw ? (Array.isArray(raw) ? raw[0] : raw).split(';')[0] : fallback
    }

    async function enter(entryUrl, site) {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        makeApplication([site])
      )
      const response = await server.inject({
        method: 'GET',
        url: entryUrl,
        headers: operatorHeaders
      })
      expect(response.headers.location).toBe(BASE_URL)
      return sessionCookieFrom(response, emptyCookie)
    }

    test('"Include in this application" opens check-your-answers with what is already known', async () => {
      const sessionCookie = await enter(PROMOTE_ENTRY_URL, REEX_SITE)

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(extractRowHtml(result, 'site-name')).toContain('Re/Ex Site')
      expect(extractRowHtml(result, 'location')).toContain(
        'Unit 1, Rotterdam, Netherlands'
      )
      expect(extractRowHtml(result, 'contact-name')).toContain('Not provided')
      expect(result).not.toContain('data-testid="error-summary"')
    })

    test('refuses to include it until the gaps are filled, naming only what is missing', async () => {
      const sessionCookie = await enter(PROMOTE_ENTRY_URL, REEX_SITE)
      const promoteSpy = vi.spyOn(
        accreditationApiService,
        'promoteOverseasSite'
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(sessionCookie),
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(promoteSpy).not.toHaveBeenCalled()
      expect(summaryLinks(result).map(({ message }) => message)).toEqual([
        'Enter the coordinates',
        'Enter the contact name',
        'Enter the email address',
        'Select at least one recycling operation',
        'Enter at least one Basel Convention or OECD code',
        'Describe the arrangements for loads that are rejected or returned to the UK'
      ])
    })

    test('can be included once every gap has been filled in through the Change links', async () => {
      let sessionCookie = await enter(PROMOTE_ENTRY_URL, REEX_SITE)
      const promoteSpy = vi
        .spyOn(accreditationApiService, 'promoteOverseasSite')
        .mockResolvedValue({ siteId: 900002 })
      const fill = async (step, payload) => {
        const response = await server.inject({
          method: 'POST',
          url: `${stepUrl(step)}${fromCya}`,
          headers: postHeaders(sessionCookie),
          payload
        })
        expect(response.statusCode).toBe(statusCodes.redirect)
        sessionCookie = sessionCookieFrom(response, sessionCookie)
      }

      await fill(
        'site-location',
        'addressLine1=Unit+1&townOrCity=Rotterdam&country=Netherlands&coordinates=51.9225%2C+4.4792'
      )
      await fill(
        'site-contact-details',
        'siteContactName=Jane+Smith&siteContactEmail=jane%40example.com'
      )
      await fill('recycling-operation-details', 'recyclingOperationCodes=R3')
      await fill(
        'basel-convention-and-oecd-code',
        'action=continue&visibleCount=1&code-0=A1181'
      )
      await fill('repatriated-loads', 'repatriatedLoads=Returned+in+30+days')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(sessionCookie),
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
      expect(promoteSpy).toHaveBeenCalledWith(
        null,
        APPLICATION_ID,
        900002,
        expect.objectContaining({
          siteName: 'Re/Ex Site',
          coordinates: '51.9225, 4.4792',
          contactName: 'Jane Smith',
          operationCodes: ['R3'],
          code1: 'A1181'
        })
      )
    })

    test('the same goes for an existing accredited site opened with Change', async () => {
      const sessionCookie = await enter(EDIT_ENTRY_URL, {
        ...REEX_SITE,
        siteId: 900001,
        selected: true
      })
      const updateSpy = vi.spyOn(accreditationApiService, 'updateOverseasSite')

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders(sessionCookie),
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(updateSpy).not.toHaveBeenCalled()
      expect(summaryLinks(result)).not.toHaveLength(0)
    })

    test('and the next registered site goes through the same page (add several in a loop)', async () => {
      const first = await enter(PROMOTE_ENTRY_URL, REEX_SITE)
      const second = await enter(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900003`,
        { ...REEX_SITE, siteId: 900003, siteName: 'Second Re/Ex Site' }
      )

      const page = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: second }
      })

      expect(first).toBeTruthy()
      expect(extractRowHtml(page.result, 'site-name')).toContain(
        'Second Re/Ex Site'
      )
      expect(extractRowHtml(page.result, 'contact-name')).toContain(
        'Not provided'
      )
    })
  })

  describe('interim sites already on the site', () => {
    const EDIT_ENTRY_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`
    const SITE_WITH_INTERIMS = {
      siteId: 900001,
      siteName: 'Accredited Site',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      country: 'Netherlands',
      selected: true,
      interimSites: [
        {
          siteId: 1,
          siteName: 'Porto Depot',
          addressLine1: '1 Rua Example',
          townOrCity: 'Porto',
          country: 'Portugal',
          contactName: 'Ana Silva',
          contactEmail: 'ana@example.com',
          contactPhone: '+351 22 000 0000',
          operationCodes: ['R12', 'R13']
        },
        { siteId: 2, siteName: 'Withdrawn Depot', removedAt: '2026-09-01' }
      ]
    }

    async function openEdit(application) {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        application
      )
      const entry = await server.inject({
        method: 'GET',
        url: EDIT_ENTRY_URL,
        headers: operatorHeaders
      })
      const raw = entry.headers['set-cookie']
      return (Array.isArray(raw) ? raw[0] : (raw ?? emptyCookie)).split(';')[0]
    }

    test('are listed read-only with their details, withdrawn ones left out', async () => {
      const cookie = await openEdit(makeApplication([SITE_WITH_INTERIMS]))

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="interim-sites-heading"')
      expect(result).toContain('Porto Depot')
      expect(result).toContain('1 Rua Example, Porto, Portugal')
      expect(result).toContain('Ana Silva')
      expect(result).toContain('ana@example.com')
      expect(result).toContain('R12, R13')
      expect(result).not.toContain('Withdrawn Depot')
      expect(result).not.toContain('change-interim')
    })

    test('are not mentioned for a site that has none', async () => {
      const cookie = await openEdit(
        makeApplication([{ ...SITE_WITH_INTERIMS, interimSites: [] }])
      )

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).not.toContain('data-testid="interim-sites-heading"')
    })

    test('failing to load them does not stop the page being used', async () => {
      const cookie = await openEdit(makeApplication([SITE_WITH_INTERIMS]))
      vi.spyOn(accreditationApiService, 'getApplication').mockRejectedValue(
        new Error('network error')
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="interim-sites-heading"')
      expect(result).toContain('data-testid="submit-button"')
    })
  })

  // Conditions of export only apply to Steel and Aluminium, and the material
  // lives in the session, so these call the handlers directly.
  describe('Steel and Aluminium sites also need conditions of export', () => {
    const ANSWERS = {
      siteName: 'Steel Recyclers',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      country: 'Netherlands',
      coordinates: '51.9225, 4.4792',
      siteContactName: 'Jane Smith',
      siteContactEmail: 'jane@example.com',
      recyclingOperationCodes: ['R4'],
      baselAndOecdCodes: ['A1181'],
      repatriatedLoads: 'Returned within 30 days'
    }

    function mockRequest(materialType, answers) {
      return {
        path: BASE_URL,
        params: { applicationId: APPLICATION_ID },
        payload: {},
        server: { logger: { warn: vi.fn(), error: vi.fn() } },
        yar: {
          get: vi.fn((key) => {
            if (key === ACCREDITATION_SESSION_KEYS.materialType) {
              return materialType
            }
            if (key === ACCREDITATION_SESSION_KEYS.addOverseasSite) {
              return answers
            }
            return null
          }),
          set: vi.fn(),
          clear: vi.fn(),
          flash: vi.fn()
        }
      }
    }

    function mockH() {
      return {
        view: vi.fn((view, data) => ({
          viewData: data,
          code: vi.fn((status) => ({ status, viewData: data }))
        })),
        redirect: vi.fn((url) => ({ redirectedTo: url }))
      }
    }

    const rowIds = (viewData) => viewData.rows.map((row) => row.testId)

    test.each(['Steel', 'Aluminium'])(
      '%s: the conditions-of-export row is shown, as "Not provided", before it is answered',
      async (materialType) => {
        const { viewData } = await addOrsCyaGetController.handler(
          mockRequest(materialType, ANSWERS),
          mockH()
        )

        const row = viewData.rows.find(
          ({ testId }) => testId === 'conditions-of-export'
        )
        expect(row).toMatchObject({ isBlank: true, errors: [] })
      }
    )

    test('other materials are not asked, so the row stays out of the page', async () => {
      const { viewData } = await addOrsCyaGetController.handler(
        mockRequest('Plastic', { ...ANSWERS, recyclingOperationCodes: ['R3'] }),
        mockH()
      )

      expect(rowIds(viewData)).not.toContain('conditions-of-export')
    })

    test('a Steel site cannot be saved without it', async () => {
      const createSpy = vi.spyOn(accreditationApiService, 'createOverseasSite')

      const response = await addOrsCyaPostController.handler(
        mockRequest('Steel', ANSWERS),
        mockH()
      )

      expect(response.status).toBe(statusCodes.badRequest)
      expect(createSpy).not.toHaveBeenCalled()
      expect(response.viewData.errorSummary).toEqual([
        {
          message: 'Select yes if the site meets the conditions of export',
          href: `${stepUrl('conditions-of-export')}${fromCya}`
        }
      ])
    })

    test.each([true, false])(
      'a Steel site that answered %s goes through',
      async (answer) => {
        vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
          makeApplication([])
        )
        const createSpy = vi
          .spyOn(accreditationApiService, 'createOverseasSite')
          .mockResolvedValue({ siteId: 5 })

        const response = await addOrsCyaPostController.handler(
          mockRequest('Steel', { ...ANSWERS, conditionsOfExport: answer }),
          mockH()
        )

        expect(response).toEqual({ redirectedTo: SELECT_ORS_URL })
        expect(createSpy).toHaveBeenCalledWith(
          null,
          APPLICATION_ID,
          expect.objectContaining({ conditionsOfExport: answer })
        )
      }
    )
  })
})
