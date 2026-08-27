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

const APPLICATION_ID = 'app-is-sn-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`
const COUNTRY_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/country`
const SITE_LOCATION_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

describe('#addInterimSiteNameController', () => {
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

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  function cookiesFrom(response) {
    const raw = response.headers['set-cookie']
    if (!raw) {
      return ''
    }
    return Array.isArray(raw)
      ? raw.map((c) => c.split(';')[0]).join('; ')
      : raw.split(';')[0]
  }

  // RA-486: every GET on the interim wizard now guards on linkedSiteId, so
  // GET tests must first walk through the ORS "Save and add interim site"
  // entry point to seed a real linkedSiteId in session.
  async function seedLinkedSiteSession() {
    vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue({
      applicationId: APPLICATION_ID,
      organisationId: 'org-001',
      overseasSites: { sectionStatus: 'InProgress', sites: [] }
    })
    vi.spyOn(accreditationApiService, 'createOverseasSite').mockResolvedValue({
      siteId: 555
    })

    const cyaResponse = await server.inject({
      method: 'POST',
      url: `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`,
      headers: postHeaders,
      payload: 'action=addInterimSite'
    })
    expect(cyaResponse.statusCode).toBe(statusCodes.redirect)
    expect(cyaResponse.headers.location).toBe(COUNTRY_URL)

    return cookiesFrom(cyaResponse)
  }

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

    test('returns 200 with page heading', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('What is the name of the interim site?')
    })

    test('renders site name input', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="site-name-input"')
    })

    test('back link points to country', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(COUNTRY_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    // RA-481: this wizard holds its draft in session, not on the
    // application, so once overseasSites is locked there's nothing
    // meaningful to render read-only — send the operator back to the
    // section's list page instead.
    test('redirects to select-overseas-sites when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      const cookie = await seedLinkedSiteSession()
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('pre-populates input with value from session when returning via Back', async () => {
      const cookie = await seedLinkedSiteSession()
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: 'siteName=My+Interim+Depot'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = cookiesFrom(postResponse) || cookie

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(getResponse.statusCode).toBe(statusCodes.ok)
      expect(getResponse.result).toContain('My Interim Depot')
    })

    test('returns 200 in Welsh locale', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] What is the name of the interim site?')
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to site-location when site name is valid', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'siteName=Interim+Staging+GmbH'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SITE_LOCATION_URL)
    })

    test('redirects to select-overseas-sites without saving when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'siteName=Interim+Staging+GmbH'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('saves site name to session on valid POST', async () => {
      const cookie = await seedLinkedSiteSession()
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: 'siteName=Interim+Ltd'
      })
      const sessionCookie = cookiesFrom(postResponse) || cookie

      const getResponse = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(getResponse.result).toContain('Interim Ltd')
    })

    test('returns 400 with inline error when site name is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Enter the site name')
    })

    test('returns 400 with error when siteName is whitespace only', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'siteName=   '
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the site name')
    })
  })
})
