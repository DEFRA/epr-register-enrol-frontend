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
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { setMultipleInterimSitesEnabled } from '../../common/test-helpers/feature-flags.js'

const APPLICATION_ID = 'app-cos-001'

// Everything a fresh add of a Plastic site asks for, so a site counts as
// complete unless a test takes something away.
const COMPLETE_DETAILS = {
  addressLine1: '123 Test St',
  townOrCity: 'Berlin',
  coordinates: '52.5200, 13.4050',
  contactName: 'Jane Smith',
  contactEmail: 'jane@example.com',
  operationCodes: ['R3'],
  code1: 'A1181',
  repatriatedLoads: 'Returned within 30 days'
}

const SITE_ONE = {
  siteId: 900001,
  siteName: 'Site Alpha',
  siteAddress: '123 Test St',
  country: 'Germany',
  isEu: true,
  isOecd: true,
  ...COMPLETE_DETAILS
}

const SITE_TWO = {
  siteId: 900002,
  siteName: 'Site Beta',
  siteAddress: '456 Test Ave',
  country: 'Chad',
  isEu: false,
  isOecd: false,
  ...COMPLETE_DETAILS
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
      sites: [SITE_ONE, SITE_TWO]
    },
    ...overrides
  }
}

describe('#confirmOverseasSitesController', () => {
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

  describe('GET /accreditation/confirm-overseas-sites/{applicationId}', () => {
    test('redirects to query-task-list when application is Queried and overseas sites section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test('returns 200 with page heading and sites list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Confirm your overseas reprocessing sites')
      expect(result).toContain('data-testid="sites-list"')
      expect(result).toContain('Site Alpha')
      expect(result).toContain('Germany')
    })

    test('renders change link for each site pointing back to select-overseas-sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="change-link-900001"')
      expect(result).toContain('data-testid="change-link-900002"')
    })

    test('renders confirm button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="confirm-button"')
    })

    test('shows no-sites message when sites array is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: [] }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('handles null overseasSites.sites gracefully', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: { sectionStatus: 'NotStarted', sites: null }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-sites-message"')
    })

    test('back link points to select-overseas-sites', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).toContain(
        `/accreditation/select-overseas-sites/${APPLICATION_ID}`
      )
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    // RA-486: gap fix -- an interim site attached to a selected ORS must be
    // visible on this pre-confirm summary too, not just select-overseas-sites.
    test('renders the nested interim-site row when a site has one', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          overseasSites: {
            sectionStatus: 'NotStarted',
            sites: [
              {
                ...SITE_ONE,
                interimSite: { siteId: 42, siteName: 'Interim Depot' }
              },
              SITE_TWO
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).toContain('data-testid="interim-site-row-42"')
      expect(result).toContain('data-testid="interim-site-name-42"')
      expect(result).toContain('Interim Depot')
      expect(result).not.toContain('data-testid="change-interim-site-42"')
    })

    // RA-630: an ORS can hold many interim sites since RA-603, in the
    // `interimSites` list. This page read only the singular mirror, so it
    // showed one of them.
    describe('with multiple interim sites', () => {
      async function renderWithInterimSites(siteOverrides) {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            overseasSites: {
              sectionStatus: 'NotStarted',
              sites: [{ ...SITE_ONE, ...siteOverrides }, SITE_TWO]
            }
          })
        )

        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
        })
        return result
      }

      describe('enabled', () => {
        let flag
        beforeEach(() => {
          flag = setMultipleInterimSitesEnabled(true)
        })
        afterEach(() => {
          flag.mockRestore()
        })

        test('lists every interim site on the ORS', async () => {
          const result = await renderWithInterimSites({
            interimSites: [
              { siteId: 42, siteName: 'First Depot' },
              { siteId: 43, siteName: 'Second Depot' }
            ]
          })

          expect(result).toContain('data-testid="interim-site-row-42"')
          expect(result).toContain('data-testid="interim-site-row-43"')
          expect(result).toContain('data-testid="interim-site-name-42"')
          expect(result).toContain('data-testid="interim-site-name-43"')
          expect(result).toContain('First Depot')
          expect(result).toContain('Second Depot')
        })

        test('leaves out a withdrawn interim site', async () => {
          const result = await renderWithInterimSites({
            interimSites: [
              { siteId: 42, siteName: 'First Depot' },
              {
                siteId: 43,
                siteName: 'Withdrawn Depot',
                removedAt: '2026-09-01T00:00:00Z'
              }
            ]
          })

          expect(result).toContain('data-testid="interim-site-row-42"')
          expect(result).not.toContain('data-testid="interim-site-row-43"')
          expect(result).not.toContain('Withdrawn Depot')
        })

        test('prefers the interimSites list over a stale singular mirror', async () => {
          const result = await renderWithInterimSites({
            interimSite: { siteId: 41, siteName: 'Stale Mirror' },
            interimSites: [{ siteId: 42, siteName: 'Authoritative Depot' }]
          })

          expect(result).toContain('Authoritative Depot')
          expect(result).not.toContain('Stale Mirror')
        })
      })

      test('lists only the first active interim site when the feature is off', async () => {
        const flag = setMultipleInterimSitesEnabled(false)
        const result = await renderWithInterimSites({
          interimSites: [
            { siteId: 42, siteName: 'First Depot' },
            { siteId: 43, siteName: 'Second Depot' }
          ]
        })
        flag.mockRestore()

        expect(result).toContain('data-testid="interim-site-row-42"')
        expect(result).not.toContain('data-testid="interim-site-row-43"')
        expect(result).not.toContain('Second Depot')
      })
    })

    test('does not render an interim-site row when there is none', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(result).not.toContain('data-testid="interim-site-row-900001"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Confirm your overseas reprocessing sites'
      )
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders read-only (200, not a redirect), without Change links or confirm button, when locked (%s)',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            overseasSites: {
              sectionStatus: 'Completed',
              sites: [SITE_ONE, SITE_TWO]
            }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
        expect(result).not.toContain('data-testid="change-link-900001"')
        expect(result).not.toContain('data-testid="confirm-button"')
      }
    )
  })

  describe('POST /accreditation/confirm-overseas-sites/{applicationId}', () => {
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
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 500 when GET application fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('confirm action patches SectionStatus Completed and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/overseas-sites`),
        { sectionStatus: 'Completed' }
      )
    })

    test('confirm action returns 500 when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page when locked (%s), without patching',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            overseasSites: {
              sectionStatus: 'Completed',
              sites: [SITE_ONE, SITE_TWO]
            }
          })
        )
        const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
          payload: { submitAction: 'confirm' }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
        )
        expect(patchSpy).not.toHaveBeenCalled()
      }
    )

    test('redirects back to this page (not a raw error) when the PATCH fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`
      )
    })
  })

  // RA-xxx: the section is not marked complete while a site in the application
  // is missing details. The operator is sent to the site list, which says which.
  describe('POST — a site in the application is missing details', () => {
    const LIST_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`
    const BARE_SITE = {
      siteId: 900001,
      siteName: 'Site Alpha',
      country: 'Germany'
    }

    const confirm = () =>
      server.inject({
        method: 'POST',
        url: `/accreditation/confirm-overseas-sites/${APPLICATION_ID}`,
        payload: { submitAction: 'confirm' }
      })

    function applicationWith(...sites) {
      return makeApplication({
        overseasSites: { sectionStatus: 'InProgress', sites }
      })
    }

    test('does not mark the section complete, and sends the operator to the site list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(applicationWith(BARE_SITE))
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await confirm()

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(LIST_URL)
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('the list then names the site that needs attention, once', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(applicationWith(BARE_SITE))
      const turnedBack = await confirm()
      const cookie = turnedBack.headers['set-cookie']
        .map((c) => c.split(';')[0])
        .join('; ')

      const first = await server.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { cookie }
      })
      expect(first.result).toContain('data-testid="error-summary"')
      expect(first.result).toContain(
        `<a href="${LIST_URL}/edit/900001" data-testid="incomplete-site-error-0">Complete the missing details for Site Alpha</a>`
      )

      const again = await server.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { cookie }
      })
      expect(again.result).not.toContain('data-testid="error-summary"')
      expect(again.result).toContain('accredited-site-incomplete-900001')
    })

    test('one incomplete site among complete ones is enough to turn the operator back', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith(SITE_ONE, { ...SITE_TWO, contactEmail: '' })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers } = await confirm()

      expect(headers.location).toBe(LIST_URL)
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('a registered site that was never included does not hold the section up', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        applicationWith(SITE_ONE, {
          ...BARE_SITE,
          siteId: 900009,
          selected: false
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers } = await confirm()

      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalled()
    })

    test('a Steel site that has not answered conditions of export holds the section up', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        ...applicationWith({ ...SITE_ONE, operationCodes: ['R4'] }),
        materialType: 'Steel'
      })
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers } = await confirm()

      expect(headers.location).toBe(LIST_URL)
      expect(patchSpy).not.toHaveBeenCalled()
    })
  })
})
