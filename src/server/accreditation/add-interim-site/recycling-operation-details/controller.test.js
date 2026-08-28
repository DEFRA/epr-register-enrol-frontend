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

const APPLICATION_ID = 'app-interim-rod-001'
const BASE_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/recycling-operation-details`
const BACK_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/site-contact-details`
const NEXT_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/check-your-answers`
const COUNTRY_URL = `/accreditation/add-interim-site/${APPLICATION_ID}/country`
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

describe('#addInterimSiteRecyclingOperationController', () => {
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

  // The interim wizard now guards every GET on linkedSiteId (RA-486), so
  // every test in this file must first walk through the ORS "Save and add
  // interim site" entry point to seed a real linkedSiteId in session,
  // exactly like an operator would.
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

    test('returns 200 with page heading once a linked ORS site exists', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain(
        'What recycling operations are carried out at the site?'
      )
    })

    test('back link points to site-contact-details', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
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

    test('offers all five codes regardless of ORS materialType (no material filtering)', async () => {
      const cookie = await seedLinkedSiteSession()

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie }
      })

      for (const code of ['R3', 'R4', 'R5', 'R12', 'R13']) {
        expect(result).toContain(`data-testid="option-${code}"`)
      }
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('returns 400 when no operation is selected', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select at least one recycling operation')
    })

    test('returns 400 when only R3/R4/R5 are selected (R12/R13 is mandatory here)', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: 'recyclingOperationCodes=R3&recyclingOperationCodes=R4'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select R12 or R13')
    })

    test('allows R12 alone (R3/R4/R5 are optional here)', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: 'recyclingOperationCodes=R12'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('redirects to check-your-answers and persists codes when R12/R13 accompanied by R3/R4/R5', async () => {
      const cookie = await seedLinkedSiteSession()

      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload:
          'recyclingOperationCodes=R3&recyclingOperationCodes=R12&recyclingOperationCodes=R13'
      })

      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      expect(postResponse.headers.location).toBe(NEXT_URL)

      const sessionCookie = cookiesFrom(postResponse) || cookie
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toMatch(/value="R3"\s+checked/)
      expect(result).toMatch(/value="R12"\s+checked/)
      expect(result).toMatch(/value="R13"\s+checked/)
    })

    test('returns 400 when a code outside R3/R4/R5/R12/R13 is submitted', async () => {
      const cookie = await seedLinkedSiteSession()

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: { ...postHeaders, cookie },
        payload: 'recyclingOperationCodes=R7'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select at least one recycling operation')
    })
  })
})
