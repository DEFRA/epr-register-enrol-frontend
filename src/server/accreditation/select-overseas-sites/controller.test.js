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
  siteName: 'Site Alpha',
  siteAddress: '123 Test St',
  country: 'Germany',
  isEu: true,
  isOecd: true,
  selected: true
}

const REGISTERED_SITE = {
  siteId: 900002,
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
  siteName: 'Site Gamma',
  country: 'France',
  selected: true,
  isNewSite: true
}

const REGISTERED_SITE_ADDED = {
  siteId: 900004,
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

    test('renders the page (no redirect) when overseas sites section itself is Queried', async () => {
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
      expect(result).toContain('Please confirm the overseas site selection.')
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
  })
})
