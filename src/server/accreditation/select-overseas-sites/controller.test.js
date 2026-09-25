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
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

const APPLICATION_ID = 'app-sos-001'

const ACCREDITED_SITE = {
  siteId: 900001,
  orsId: '001',
  siteName: 'Site Alpha',
  siteAddress: '123 Test St',
  country: 'Germany',
  isEu: true,
  isOecd: true,
  selected: true
}

const REGISTERED_SITE = {
  siteId: 900002,
  orsId: '002',
  siteName: 'Site Beta',
  siteAddress: '456 Test Ave',
  country: 'Chad',
  isEu: false,
  isOecd: false,
  selected: false,
  operationCodes: ['R3', 'R12']
}

const NEW_SITE = {
  siteId: 900003,
  orsId: '003',
  siteName: 'Site Gamma',
  country: 'France',
  selected: true,
  isNewSite: true
}

const REGISTERED_SITE_ADDED = {
  siteId: 900004,
  orsId: '004',
  siteName: 'Site Delta',
  country: 'Japan',
  selected: true,
  registeredNowAccredited: true
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'NotStarted',
      sites: [ACCREDITED_SITE, REGISTERED_SITE]
    },
    ...overrides
  }
}

describe('#selectOverseasSitesController', () => {
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

  describe('GET /accreditation/select-overseas-sites/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Select the overseas reprocessing sites')
    })

    test('places sites into their respective sections', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              ACCREDITED_SITE,
              REGISTERED_SITE,
              NEW_SITE,
              REGISTERED_SITE_ADDED
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="accredited-site-row-900001"')
      expect(result).toContain('data-testid="registered-site-row-900002"')
      expect(result).toContain('data-testid="new-site-row-900003"')
      expect(result).toContain(
        'data-testid="registered-sites-added-row-900004"'
      )
    })

    test('does not render a section heading when that section is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="accredited-heading"')
      expect(result).toContain('data-testid="registered-heading"')
      expect(result).not.toContain('data-testid="new-sites-heading"')
      expect(result).not.toContain(
        'data-testid="registered-sites-added-heading"'
      )
    })

    // RA-507: the ORS id disambiguates sites with similar/identical names on the one page an
    // operator adds to or removes from their accreditation, across every section a site can
    // appear in.
    test('shows the ORS id alongside the site name in every section', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              ACCREDITED_SITE,
              REGISTERED_SITE,
              NEW_SITE,
              REGISTERED_SITE_ADDED
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      // RA-603: the page is a govuk-table now, so the ORS id lives in a column
      // named by its own <th scope="col">. The visually-hidden "ORS ID" label
      // that the summary-list version put inside every cell has gone with it -
      // keeping both made a screen reader announce the label twice per row.
      expect(result).toContain('data-testid="accredited-site-orsid-900001">001')
      expect(result).toContain('data-testid="registered-site-orsid-900002">002')
      expect(result).toContain('data-testid="new-site-orsid-900003">003')
      expect(result).toContain(
        'data-testid="registered-sites-added-orsid-900004">004'
      )
    })

    // RA-603: a table column has to exist in every row or every column below it
    // shifts, so the cell is now always emitted - empty rather than absent.
    test('emits an empty ORS id cell when a site has none', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'NotStarted',
            sites: [{ ...ACCREDITED_SITE, orsId: null }]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="accredited-site-row-900001"')
      expect(result).toContain(
        'data-testid="accredited-site-orsid-900001"></td>'
      )
    })

    test('registered site Add To Accreditation link points to the promote route', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-button-registered-900002"')
      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`
      )
    })

    test('accredited site Change link points to the edit route', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="edit-button-accredited-900001"')
      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`
      )
    })

    test('new site and registered-sites-added Change links point to the edit route', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, NEW_SITE, REGISTERED_SITE_ADDED]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="edit-button-new-900003"')
      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900003`
      )
      expect(result).toContain(
        'data-testid="edit-button-registered-added-900004"'
      )
      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900004`
      )
    })

    test('registered site (not yet accredited) has no Change link', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'data-testid="edit-button-registered-900002"'
      )
    })

    test('shows no-sites message when overseasSites.sites is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="no-sites-message"')
      expect(result).not.toContain('data-testid="continue-form"')
    })

    test('handles null overseasSites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ overseasSites: null })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('continue button is present inside the form', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain('data-testid="continue-form"')
    })

    test('back link points to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(`/accreditation/task-list/${APPLICATION_ID}`)
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Select the overseas reprocessing sites')
    })

    test('renders Add New ORS button linking to the wizard reset-and-start route', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="add-new-ors-button"')
      expect(result).toContain(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/new`
      )
    })

    test('does not show success banner when no flash is set', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="ors-success-banner"')
      expect(result).not.toContain('data-testid="ors-promote-success-banner"')
      expect(result).not.toContain('data-testid="ors-edit-success-banner"')
    })

    test('does not show interim-site success banner when no flash is set', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="interim-site-success-banner"')
    })

    test('shows interim-site success banner after completing the add-interim-site wizard', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(accreditationApiService, 'createInterimSite').mockResolvedValue({
        siteId: 1,
        siteNumber: 'SN-001',
        isNewSite: true
      })

      function cookieHeaderFrom(response, fallback) {
        const raw = response.headers['set-cookie']
        if (!raw) {
          return fallback
        }
        return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
      }

      const countryResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/country`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: 'country=France'
      })
      expect(countryResponse.statusCode).toBe(statusCodes.redirect)
      let sessionCookie = cookieHeaderFrom(countryResponse, '')

      const siteNameResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'siteName=Interim+Depot'
      })
      expect(siteNameResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(siteNameResponse, sessionCookie)

      const siteLocationResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-location`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: 'addressLine1=Unit+1&townOrCity=Rotterdam'
      })
      expect(siteLocationResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(siteLocationResponse, sessionCookie)

      const contactDetailsResponse = await server.inject({
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
      expect(contactDetailsResponse.statusCode).toBe(statusCodes.redirect)
      sessionCookie = cookieHeaderFrom(contactDetailsResponse, sessionCookie)

      const cyaPostResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/check-your-answers`,
        headers: {
          ...operatorHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: sessionCookie
        },
        payload: ''
      })
      expect(cyaPostResponse.statusCode).toBe(statusCodes.redirect)
      expect(cyaPostResponse.headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      sessionCookie = cookieHeaderFrom(cyaPostResponse, sessionCookie)

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('data-testid="interim-site-success-banner"')
    })

    test('redirects to query-task-list when application is Queried and overseas sites section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'NotStarted',
            sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders read-only (200, not a redirect) when application is locked (%s) and overseas sites section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            overseasSites: {
              sectionStatus: 'Completed',
              sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
            }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
        expect(result).not.toContain('data-testid="add-new-ors-button"')
      }
    )

    test('renders read-only, without remove/add/continue actions, when application is Queried and overseas sites section is Completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="read-only-notice"')
      expect(result).not.toContain('data-testid="continue-form"')
      expect(result).not.toContain(
        'data-testid="remove-button-accredited-900001"'
      )
      expect(result).not.toContain('data-testid="add-new-ors-button"')
      expect(result).toContain(
        `href="/accreditation/query-task-list/${APPLICATION_ID}"`
      )
    })

    test('does not render the regulator-query banner for a read-only section, even though another section is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
          },
          businessPlan: { sectionStatus: 'Queried' },
          query: { queryNote: 'Please break down the price support spend.' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="regulator-query-banner"')
      expect(result).not.toContain('Please break down the price support spend.')
    })

    test('renders the page (no redirect) without the officer note when the overseas sites section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Queried',
            sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
          },
          query: { queryNote: 'Please confirm the overseas site selection.' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="continue-form"')
      // RA-590: the banner still tells the operator the section is
      // queried, but must not carry the officer's free-text note.
      expect(result).toContain('data-testid="regulator-query-banner"')
      expect(result).not.toContain('data-testid="query-note"')
      // the record still carries the note, so assert on the whole
      // response rather than on the removed element alone.
      expect(result).not.toContain(
        'Please confirm the overseas site selection.'
      )
    })

    test('hides the regulator-query banner when REGULATOR_QUERY_TEXT_DISABLED is true', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Queried',
            sites: [{ siteId: 900001, siteName: 'Site Alpha' }]
          },
          query: { queryNote: 'Please confirm the overseas site selection.' }
        })
      )
      const originalConfigGet = config.get.bind(config)
      const configSpy = vi
        .spyOn(config, 'get')
        .mockImplementation((key) =>
          key === 'regulatorQuery.textDisabled' ? true : originalConfigGet(key)
        )

      try {
        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).not.toContain('data-testid="regulator-query-banner"')
        expect(result).not.toContain(
          'Please confirm the overseas site selection.'
        )
      } finally {
        configSpy.mockRestore()
      }
    })
  })

  describe('GET /accreditation/select-overseas-sites/{applicationId}/promote/{siteId}', () => {
    test('redirects back to select-overseas-sites when the application fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('redirects back to select-overseas-sites when siteId matches no site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/999999`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('redirects to site-name and seeds the session when the site is found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
      )
    })

    test("re-populates all of the site's existing R-codes as checked on recycling-operation-details", async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      function cookieHeaderFrom(response, fallback) {
        const raw = response.headers['set-cookie']
        if (!raw) {
          return fallback
        }
        return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
      }

      const promoteResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`,
        headers: operatorHeaders
      })
      expect(promoteResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = cookieHeaderFrom(promoteResponse, '')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toMatch(/value="R3"\s+checked/)
      expect(result).toMatch(/value="R12"\s+checked/)
    })

    // RA-470: the promote-entry controller previously skipped the Queried-section write
    // guard entirely, unlike the main GET/POST handlers -- so a direct link into this route
    // could start (and eventually submit) a write against a section the regulator-query flow
    // should have locked. Fixed by routing through the same guard used everywhere else.
    test('redirects to query-task-list, without seeding the session, when application is Queried and overseas sites section is not', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ ...REGISTERED_SITE }]
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/promote/900002`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })
  })

  describe('GET /accreditation/select-overseas-sites/{applicationId}/edit/{siteId}', () => {
    test('redirects back to select-overseas-sites when the application fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('redirects back to select-overseas-sites when siteId matches no site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/999999`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('redirects to site-name and seeds the session (editingSiteId) when the site is found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`
      )
    })

    test("re-populates the site's existing name on site-name", async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      function cookieHeaderFrom(response, fallback) {
        const raw = response.headers['set-cookie']
        if (!raw) {
          return fallback
        }
        return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
      }

      const editResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`,
        headers: operatorHeaders
      })
      expect(editResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = cookieHeaderFrom(editResponse, '')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/add-overseas-site/${APPLICATION_ID}/site-name`,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('Site Alpha')
    })

    test('redirects to query-task-list, without seeding the session, when application is Queried and overseas sites section is not', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: [{ ...ACCREDITED_SITE }]
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/edit/900001`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })
  })

  describe('POST /accreditation/select-overseas-sites/{applicationId}', () => {
    test('redirects to query-task-list when application is Queried and overseas sites section is not, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: {
            sectionStatus: 'Completed',
            sites: makeApplication().overseasSites.sites
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'continue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('redirects to query-task-list when application is Queried and overseas sites section has not been started, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'continue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page when application is locked (%s) and overseas sites section is not Queried, without patching',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            overseasSites: {
              sectionStatus: 'Completed',
              sites: [
                { siteId: 900001, siteName: 'Site Alpha', selected: true }
              ]
            }
          })
        )
        const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
          headers: operatorHeaders,
          payload: { submitAction: 'removeAccredited', siteId: '900001' }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/select-overseas-sites/${APPLICATION_ID}`
        )
        expect(patchSpy).not.toHaveBeenCalled()
      }
    )

    test('continue redirects to confirm-overseas-sites when at least one accredited site exists', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'continue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('continue returns 400 with error when no sites are accredited', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'NotStarted',
            sites: [REGISTERED_SITE]
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'continue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain(
        'Add at least one overseas reprocessing site to accreditation'
      )
    })

    test('saveAndComeLater patches InProgress status and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining('overseas-sites'),
        { sectionStatus: 'InProgress' }
      )
    })

    test('saveAndComeLater returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('removeAccredited patches the site to selected:false and redirects back', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'removeAccredited', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining('overseas-sites'),
        expect.objectContaining({
          sites: expect.arrayContaining([
            expect.objectContaining({ siteId: 900001, selected: false })
          ])
        })
      )
    })

    test('removeAccredited returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'removeAccredited', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('removeAccredited redirects back to this page (not a raw error) when the PATCH fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'removeAccredited', siteId: '900001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('deleteNewSite removes the site from the array entirely', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, NEW_SITE]
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'deleteNewSite', siteId: '900003' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining('overseas-sites'),
        {
          sites: [ACCREDITED_SITE]
        }
      )
    })

    test('revertAccreditation calls the revert API and redirects back', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, REGISTERED_SITE_ADDED]
          }
        })
      )
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'revertAccreditation', siteId: '900004' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('overseas-sites/900004/revert')
      )
    })

    test('revertAccreditation returns 500 when the API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, REGISTERED_SITE_ADDED]
          }
        })
      )
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('revert failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'revertAccreditation', siteId: '900004' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('revertAccreditation redirects back to this page (not a raw error) when the API call fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, REGISTERED_SITE_ADDED]
          }
        })
      )
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'post').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'revertAccreditation', siteId: '900004' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'continue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    // RA-486: clearing an interim site reuses the same bulk patchOverseasSites
    // endpoint as removeAccredited/deleteNewSite above, just with the
    // targeted site's interimSite field set to null.
    // RA-603: withdrawing goes through the interim site's own endpoint. It used
    // to rebuild the whole site list and send it back through the bulk PATCH,
    // which cannot survive an ORS holding several interim sites - a concurrent
    // change to any other site would be silently overwritten.
    test('removeInterimSite calls DELETE on the interim site and redirects back', async () => {
      const accreditedWithInterim = {
        ...ACCREDITED_SITE,
        interimSite: { siteId: 42, siteName: 'Interim Depot' }
      }
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [accreditedWithInterim, REGISTERED_SITE]
          }
        })
      )
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'removeInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.stringContaining('/overseas-sites/900001/interim-sites/42')
      )
      // The whole site list is no longer rewritten to remove one interim site.
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('removeInterimSite returns 500 when the withdraw fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                ...ACCREDITED_SITE,
                interimSite: { siteId: 42, siteName: 'Interim Depot' }
              }
            ]
          }
        })
      )
      vi.spyOn(apiClient, 'delete').mockRejectedValue(
        new Error('delete failed')
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'removeInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('removeInterimSite redirects back to this page (not a raw error) when the withdraw fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [
              {
                ...ACCREDITED_SITE,
                interimSite: { siteId: 42, siteName: 'Interim Depot' }
              }
            ]
          }
        })
      )
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'delete').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'removeInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })
  })

  describe('RA-486 — interim site visibility on select-overseas-sites', () => {
    test('renders the nested interim-site row with Change and Remove actions when present', async () => {
      const accreditedWithInterim = {
        ...ACCREDITED_SITE,
        interimSite: { siteId: 42, siteName: 'Interim Depot' }
      }
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [accreditedWithInterim, REGISTERED_SITE]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="interim-site-row-42"')
      expect(result).toContain('data-testid="interim-site-name-42"')
      expect(result).toContain('Interim Depot')
      expect(result).toContain('data-testid="change-interim-site-42"')
      expect(result).toContain('data-testid="remove-button-interim-site-42"')
      // RA-603: keyed on the interim site's own id (42), not its parent ORS's
      // (900001). An ORS can hold several, so the parent no longer identifies
      // which one to edit.
      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/42`
      )
    })

    test('does not render an interim-site row when there is none', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="interim-site-row-42"')
    })
  })

  describe('GET /accreditation/select-overseas-sites/{applicationId}/interim-site/edit/{siteId}', () => {
    test('redirects back to select-overseas-sites when the site has no interim site', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/42`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('redirects to the interim wizard country step and seeds the session when the interim site is found', async () => {
      const accreditedWithInterim = {
        ...ACCREDITED_SITE,
        interimSite: {
          siteId: 42,
          siteName: 'Interim Depot',
          country: 'France',
          addressLine1: 'Unit 1',
          townOrCity: 'Rotterdam',
          contactName: 'Jane Smith',
          contactEmail: 'jane@example.com',
          contactPhone: '+441234567890',
          operationCodes: ['R12']
        }
      }
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [accreditedWithInterim, REGISTERED_SITE]
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/42`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/add-interim-site/${APPLICATION_ID}/country`
      )
    })

    test("re-populates the interim site's existing name on the interim wizard's site-name step", async () => {
      const accreditedWithInterim = {
        ...ACCREDITED_SITE,
        interimSite: {
          siteId: 42,
          siteName: 'Interim Depot',
          country: 'France',
          addressLine1: 'Unit 1',
          townOrCity: 'Rotterdam',
          contactName: 'Jane Smith',
          contactEmail: 'jane@example.com',
          contactPhone: '+441234567890',
          operationCodes: ['R12']
        }
      }
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [accreditedWithInterim, REGISTERED_SITE]
          }
        })
      )

      function cookieHeaderFrom(response, fallback) {
        const raw = response.headers['set-cookie']
        if (!raw) {
          return fallback
        }
        return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
      }

      const editResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}/interim-site/edit/42`,
        headers: operatorHeaders
      })
      expect(editResponse.statusCode).toBe(statusCodes.redirect)
      const sessionCookie = cookieHeaderFrom(editResponse, '')

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/add-interim-site/${APPLICATION_ID}/site-name`,
        headers: { ...operatorHeaders, cookie: sessionCookie }
      })

      expect(result).toContain('Interim Depot')
    })
  })

  // RA-603 phase 1. The page renders interim sites by looping a list and shows
  // each one in a GOV.UK accordion, so the markup is already correct for many
  // interim sites before the backend can store more than one.
  describe('RA-603 — interim sites render as a list in an accordion', () => {
    const INTERIM_SITE = {
      siteId: 42,
      siteName: 'Interim Depot',
      country: 'France',
      addressLine1: 'Unit 1',
      townOrCity: 'Rotterdam',
      contactName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      contactPhone: '+441234567890',
      operationCodes: ['R12', 'R13']
    }

    async function renderWithSites(sites) {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'InProgress', sites }
        })
      )
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })
      return result
    }

    test('renders the disclosure for a site carrying the legacy singular interimSite', async () => {
      const result = await renderWithSites([
        { ...ACCREDITED_SITE, interimSite: INTERIM_SITE }
      ])

      expect(result).toContain('data-testid="interim-sites-disclosure-900001"')
      expect(result).toContain('Show interim sites (1)')
      expect(result).toContain('Interim Depot')
    })

    // The forward-compatible half: the moment the backend starts sending a
    // list, the page must use it rather than the singular mirror.
    test('prefers an already-list-shaped interimSites over the singular field', async () => {
      const result = await renderWithSites([
        {
          ...ACCREDITED_SITE,
          interimSite: { ...INTERIM_SITE, siteName: 'Stale Mirror' },
          interimSites: [
            { ...INTERIM_SITE, siteId: 51, siteName: 'Authoritative Depot' }
          ]
        }
      ])

      expect(result).toContain('Authoritative Depot')
      expect(result).not.toContain('Stale Mirror')
    })

    test('renders one list entry per interim site, behind a single disclosure', async () => {
      const result = await renderWithSites([
        {
          ...ACCREDITED_SITE,
          interimSites: [
            { ...INTERIM_SITE, siteId: 42, siteName: 'First Depot' },
            { ...INTERIM_SITE, siteId: 43, siteName: 'Second Depot' }
          ]
        }
      ])

      expect(result).toContain('data-testid="interim-site-row-42"')
      expect(result).toContain('data-testid="interim-site-row-43"')
      expect(result).toContain('First Depot')
      expect(result).toContain('Second Depot')
      expect(result).toContain('Show interim sites (2)')
    })

    // The disclosure line is a summary, not a record: name, country and R
    // codes only. Address and contact details are deliberately not shown.
    test('summarises an interim site as name, country and R codes only', async () => {
      const result = await renderWithSites([
        { ...ACCREDITED_SITE, interimSite: INTERIM_SITE }
      ])

      expect(result).toContain('Interim Depot')
      expect(result).toContain('R12, R13')
      expect(result).not.toContain('Unit 1, Rotterdam')
      expect(result).not.toContain('jane@example.com')
    })

    test("shows the interim site's R codes", async () => {
      const result = await renderWithSites([
        { ...ACCREDITED_SITE, interimSite: INTERIM_SITE }
      ])

      expect(result).toContain('data-testid="interim-site-operation-codes-42"')
      expect(result).toContain('R12, R13')
    })

    test('renders no disclosure at all for a site with no interim sites', async () => {
      const result = await renderWithSites([ACCREDITED_SITE])

      expect(result).not.toContain('Show interim sites')
    })

    test('renders no disclosure for a site with no interim site', async () => {
      const result = await renderWithSites([ACCREDITED_SITE])

      expect(result).not.toContain(
        'data-testid="interim-sites-disclosure-900001"'
      )
    })

    // AC: an ORS and its interim sites read as one unit, so the summary-list
    // rule between them is suppressed - and only then.
    test('drops the dividing rule under an ORS row that has interim sites', async () => {
      const withInterim = await renderWithSites([
        { ...ACCREDITED_SITE, interimSite: INTERIM_SITE }
      ])
      expect(withInterim).toContain('select-overseas-sites-row--has-interim')

      const withoutInterim = await renderWithSites([ACCREDITED_SITE])
      expect(withoutInterim).not.toContain(
        'select-overseas-sites-row--has-interim'
      )
    })
  })

  describe('RA-603 — table layout', () => {
    test('hides the column headings visually but keeps them for screen readers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        '<thead class="govuk-table__head govuk-visually-hidden">'
      )
      expect(result).toContain('Site name')
      expect(result).not.toContain('<thead class="govuk-table__head">')
    })

    test('renders each section as a table rather than a summary list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        '<table class="govuk-table select-overseas-sites-table" data-testid="accredited-sites-list">'
      )
      expect(result).toContain('data-testid="registered-sites-list"')
    })
  })

  // AC11. The ticket claims the current wording is "Remove from Application";
  // it was actually "Remove from accreditation"/"Add to accreditation". Either
  // way, neither phrasing may survive this change.
  describe('RA-603 AC11 — application action wording', () => {
    test('uses "Withdraw from application" and "Add to application"', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'InProgress',
            sites: [ACCREDITED_SITE, REGISTERED_SITE]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Withdraw from application')
      expect(result).toContain('Add to application')
      expect(result).not.toContain('Remove from accreditation')
      expect(result).not.toContain('Add to accreditation')
    })
  })

  // RA-603 C4. Withdrawing an interim site is soft, so it can be undone. Two
  // ways back, deliberately: the banner catches the mis-click noticed at once,
  // which is most of what will happen, and the withdrawn-sites disclosure
  // catches the operator who realises the next day, which the banner cannot.
  describe('RA-603 C4 — putting a withdrawn interim site back', () => {
    const SITE_WITH_INTERIM = {
      ...ACCREDITED_SITE,
      interimSites: [
        { siteId: 42, siteName: 'Interim Depot', country: 'France' }
      ]
    }

    function mockApplication(sites) {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'InProgress', sites }
        })
      )
    }

    test('offers an undo naming the site just withdrawn', async () => {
      mockApplication([SITE_WITH_INTERIM])
      vi.spyOn(apiClient, 'delete').mockResolvedValue({})

      const withdraw = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'removeInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      const cookie = (withdraw.headers['set-cookie'] ?? [])[0]?.split(';')[0]
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, cookie }
      })

      expect(result).toContain('data-testid="interim-site-withdrawn-banner"')
      // Naming it is what makes the offer specific rather than "undo something".
      expect(result).toContain('Interim Depot')
      expect(result).toContain('data-testid="undo-withdraw-button"')
    })

    test('does not offer an undo on a plain page load', async () => {
      mockApplication([SITE_WITH_INTERIM])

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'data-testid="interim-site-withdrawn-banner"'
      )
    })

    test('restoreInterimSite calls the restore endpoint and redirects back', async () => {
      mockApplication([
        {
          ...ACCREDITED_SITE,
          interimSites: [
            {
              siteId: 42,
              siteName: 'Interim Depot',
              removedAt: '2026-08-14T09:30:00.000Z'
            }
          ]
        }
      ])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'restoreInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/overseas-sites/900001/interim-sites/42/restore'
        )
      )
    })

    test('shows a withdrawn interim site in its own disclosure, not the main list', async () => {
      mockApplication([
        {
          ...ACCREDITED_SITE,
          interimSites: [
            { siteId: 42, siteName: 'Still Here' },
            {
              siteId: 43,
              siteName: 'Old Depot',
              removedAt: '2026-08-14T09:30:00.000Z'
            }
          ]
        }
      ])

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Show interim sites (1)')
      expect(result).toContain('Show withdrawn interim sites (1)')
      expect(result).toContain('data-testid="restore-button-interim-site-43"')
      // The withdrawn one is not offered a Change or Withdraw of its own.
      expect(result).not.toContain('data-testid="change-interim-site-43"')
    })

    test('redirects back without calling the API when the interim site is unknown', async () => {
      mockApplication([SITE_WITH_INTERIM])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'restoreInterimSite',
          siteId: '900001',
          interimSiteId: '999'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('returns 500 when the restore fails', async () => {
      mockApplication([
        {
          ...ACCREDITED_SITE,
          interimSites: [
            {
              siteId: 42,
              siteName: 'Old Depot',
              removedAt: '2026-08-14T09:30:00.000Z'
            }
          ]
        }
      ])
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('restore failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/select-overseas-sites/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          submitAction: 'restoreInterimSite',
          siteId: '900001',
          interimSiteId: '42'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
