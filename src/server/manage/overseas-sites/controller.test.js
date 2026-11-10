import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import { persistentStubApiClient } from '../../common/persistentStubApiClient.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_URL,
  MANAGE_REEX_URL,
  apiError,
  approvedRegistration,
  makeManageApp,
  mockManageGets,
  noChangeRequests,
  registrationOnlyExporter,
  registrationOnlyReprocessor
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  MANAGE_EXPORTER_ORG,
  NO_OVERSEAS_SITES_ORG,
  REGISTRATION_ONLY_ORG
} from '../../common/constants/test-orgs.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const PAGE_URL = `${MANAGE_URL}/overseas-sites`
// RA-492: read before any test spies on apiClient, which in tests is this
// same client.
const persistentGet = persistentStubApiClient.get
const WELSH_PAGE_URL = `/cy${PAGE_URL}`

const interimSite = (siteId, overrides = {}) => ({
  siteId,
  siteNumber: String(siteId).padStart(3, '0'),
  siteName: `Interim ${siteId}`,
  country: 'Belgium',
  addressLine1: `${siteId} Dock Road`,
  townOrCity: 'Antwerp',
  operationCodes: ['R3', 'R13'],
  removedAt: null,
  ...overrides
})

const ors = (siteId, overrides = {}) => ({
  siteId,
  orsId: String(siteId).padStart(3, '0'),
  siteName: `ORS ${siteId}`,
  addressLine1: `${siteId} Industrieweg`,
  townOrCity: 'Rotterdam',
  siteAddress: `${siteId} Industrieweg, Rotterdam, Netherlands`,
  country: 'Netherlands',
  selected: true,
  isNewSite: false,
  registeredNowAccredited: false,
  validFrom: '2026-01-01',
  interimSites: [],
  ...overrides
})

// One physical site under several ORSs: a copy under each, with its own id.
const sharedHub = (siteId, overrides = {}) =>
  interimSite(siteId, { siteName: 'Shared Hub', ...overrides })

const SITES = [
  ors(1, {
    siteName: 'Bharat Recycling',
    country: 'India',
    interimSites: [
      interimSite(10),
      interimSite(11, { removedAt: '2027-03-01T00:00:00Z' }),
      sharedHub(50)
    ]
  }),
  ors(2, {
    interimSites: [sharedHub(51)]
  }),
  ors(3, {
    // Withdrawn here only: still current under ORSs 1 and 2.
    interimSites: [sharedHub(52, { removedAt: '2027-04-01T00:00:00Z' })]
  }),
  // Interim sites from its registration: not on the accreditation, so hidden.
  ors(4, {
    selected: false,
    siteName: 'Registered Only Ltd',
    interimSites: [interimSite(40, { siteName: 'Registration Interim' })]
  }),
  ors(5, { selected: false }),
  // No selected value: only an explicit selection is accredited.
  ors(7, { selected: undefined }),
  // A new site the operator never put on the accreditation is on neither tab.
  ors(6, { selected: false, isNewSite: true })
]

const makeApp = (overrides = {}) =>
  makeManageApp({
    overseasSites: { sectionStatus: 'Completed', sites: SITES },
    ...overrides
  })

describe('#manageOverseasSitesController', () => {
  const page = setupManagePageServer()
  const { get } = page

  async function getPage(app = makeApp()) {
    mockManageGets([app])
    const response = await get(PAGE_URL)
    expect(response.statusCode).toBe(statusCodes.ok)
    return response.result
  }

  // The HTML of one tab panel: from its opening tag to the other panel's.
  function tabPanel(html, name) {
    const start = html.indexOf(`data-testid="${name}-sites-panel"`)
    expect(start).toBeGreaterThan(-1)
    const panel = html.slice(start)
    const other = name === 'accredited' ? 'registered' : 'accredited'
    const end = panel.indexOf(`data-testid="${other}-sites-panel"`)
    return end > -1 ? panel.slice(0, end) : panel
  }

  function disclosure(html, orsSiteId) {
    const start = html.indexOf(
      `data-testid="interim-sites-disclosure-${orsSiteId}"`
    )
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('</details>', start))
  }

  test.each([PAGE_URL, WELSH_PAGE_URL])(
    'GET %s returns 404 when the flag is off, without reading data',
    async (url) => {
      page.setInYearChangesEnabled(false)
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await get(url)

      expect(statusCode).toBe(statusCodes.notFound)
      expect(getSpy).not.toHaveBeenCalled()
    }
  )

  test('returns 403 without reading data when the operator cannot access the organisation', async () => {
    const getSpy = mockManageGets([makeApp()])

    const { statusCode } = await get(
      `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}/overseas-sites`
    )

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('returns 404 for a reprocessor accreditation', async () => {
    mockManageGets([makeApp({ wasteProcessingType: 'reprocessor' })])

    const { statusCode } = await get(PAGE_URL)

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns 404 for a reprocessor accreditation whose registration is not Approved', async () => {
    mockManageGets([makeApp({ wasteProcessingType: 'reprocessor' })], {
      ...approvedRegistration,
      status: 'Created'
    })

    const { statusCode } = await get(PAGE_URL)

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns 404 for a reprocessor accreditation whose registration has no record', async () => {
    mockManageGets(
      [makeApp({ wasteProcessingType: 'reprocessor' })],
      apiError(statusCodes.notFound)
    )

    const { statusCode } = await get(PAGE_URL)

    expect(statusCode).toBe(statusCodes.notFound)
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }) {
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toMatch(
        new RegExp(`href="${PAGE_URL}"[^>]*data-testid="try-again-link"`)
      )
    }

    // RA-697: a registration-only exporter's sites come from the same view
    // as its change requests, so without it the tabs would be empty.
    test('rather than empty tabs when a registration-only exporter’s view cannot be read', async () => {
      mockManageGets(
        [],
        registrationOnlyExporter,
        apiError(statusCodes.internalServerError)
      )

      const response = await get(PAGE_URL)

      expectServiceProblem(response)
      expect(response.result).not.toContain('accredited-sites-tab')
    })

    test.each(['Created', 'Rejected', 'Cancelled'])(
      'when the registration is %s',
      async (status) => {
        mockManageGets([makeApp()], { ...approvedRegistration, status })

        expectServiceProblem(await get(PAGE_URL))
      }
    )

    test('when the registration has no record', async () => {
      mockManageGets([makeApp()], apiError(statusCodes.notFound))

      expectServiceProblem(await get(PAGE_URL))
    })

    test('when the API fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        apiError(statusCodes.internalServerError)
      )

      expectServiceProblem(await get(PAGE_URL))
    })

    test.each([
      ['has no overseasSites', { overseasSites: undefined }],
      ['has null overseasSites', { overseasSites: null }],
      [
        'has overseasSites without a sites list',
        { overseasSites: { sectionStatus: 'Completed' } }
      ]
    ])(
      'rather than empty tabs when the accreditation %s',
      async (_case, overrides) => {
        mockManageGets([makeApp(overrides)])

        const response = await get(PAGE_URL)

        expectServiceProblem(response)
        expect(response.result).not.toContain('accredited-sites-tab')
      }
    )
  })

  describe('page content', () => {
    let result

    beforeEach(async () => {
      result = await getPage()
    })

    test('shows the heading with an "orgName (year, material)" caption', () => {
      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*Manage overseas reprocessing sites\s*</
      )
      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Acme Recycling Ltd \(2027, Plastic\)\s*</
      )
    })

    test('labels each tab with how many ORSs it holds', () => {
      expect(result).toMatch(
        /data-testid="accredited-sites-tab"[^>]*>\s*Accredited \(3\)\s*</
      )
      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(3\)\s*</
      )
    })

    test('gives each tab its heading and intro, with the year filled in', () => {
      const accredited = tabPanel(result, 'accredited')
      expect(accredited).toMatch(
        /<h2 class="govuk-heading-m[^"]*">\s*Accredited overseas reprocessing sites\s*<\/h2>/
      )
      expect(accredited).toContain(
        'These are your accredited overseas reprocessing sites for 2027.'
      )

      const registered = tabPanel(result, 'registered')
      expect(registered).toMatch(
        /<h2 class="govuk-heading-m[^"]*">\s*Registered overseas reprocessing sites\s*<\/h2>/
      )
      expect(registered).toContain(
        'These are the registered overseas reprocessing sites that you can request to add as accredited overseas reprocessing sites for 2027.'
      )
    })

    test('puts selected ORSs on Accredited and other existing ORSs on Registered', () => {
      const accredited = tabPanel(result, 'accredited')
      const registered = tabPanel(result, 'registered')

      for (const id of [1, 2, 3]) {
        expect(accredited).toContain(`data-testid="accredited-site-row-${id}"`)
        expect(registered).not.toContain(`site-row-${id}"`)
      }
      for (const id of [4, 5, 7]) {
        expect(registered).toContain(`data-testid="registered-site-row-${id}"`)
        expect(accredited).not.toContain(`site-row-${id}"`)
      }
      expect(result).not.toContain('site-row-6"')
    })

    test('shows each ORS number, name in bold, and "address line 1, country"', () => {
      expect(result).toMatch(
        /data-testid="accredited-site-orsid-1"[^>]*>\s*001\s*</
      )
      expect(result).toMatch(
        /<strong[^>]*data-testid="accredited-site-name-1"[^>]*>\s*Bharat Recycling\s*</
      )
      expect(result).toMatch(
        /data-testid="accredited-site-address-1"[^>]*>\s*1 Industrieweg, India\s*</
      )
      expect(result).toMatch(
        /<strong[^>]*data-testid="registered-site-name-4"[^>]*>\s*Registered Only Ltd\s*</
      )
      expect(result).toMatch(
        /data-testid="registered-site-address-4"[^>]*>\s*4 Industrieweg, Netherlands\s*</
      )
    })

    test('shows no dates', () => {
      const lists =
        tabPanel(result, 'accredited') + tabPanel(result, 'registered')
      expect(lists).not.toMatch(/2026|Valid/)
    })

    test('lists current interim sites as "name, country, R-codes", leaving out removed ones', () => {
      const ors1 = disclosure(result, 1)

      expect(ors1).toMatch(/Show interim sites \(2\)/)
      expect(ors1).toMatch(
        /data-testid="interim-site-row-10"[\s\S]*?Interim 10<\/span>, <span[^>]*>Belgium<\/span>, <span[^>]*>R3, R13</
      )
      expect(ors1).toContain('data-testid="interim-site-row-50"')
      expect(ors1).not.toContain('Interim 11')
    })

    test('shows a shared interim site under every ORS where it is current', () => {
      expect(disclosure(result, 1)).toContain('Shared Hub')
      expect(disclosure(result, 2)).toContain('Shared Hub')
      expect(disclosure(result, 2)).toMatch(/Show interim sites \(1\)/)
    })

    test('shows no disclosure for an ORS with no current interim sites', () => {
      expect(result).not.toContain('interim-sites-disclosure-3"')
    })

    test('never shows interim sites on the Registered tab, even for a registered ORS that has them', () => {
      const registered = tabPanel(result, 'registered')

      expect(registered).toContain('data-testid="registered-site-row-4"')
      expect(registered).not.toContain('interim-sites-disclosure')
      expect(registered).not.toContain('Show interim sites')
      expect(result).not.toContain('Registration Interim')
    })

    // RA-492's "Add to accreditation" on registered ORSs is the only action.
    test('has no change, withdraw or interim-site actions', () => {
      expect(result).not.toMatch(
        /change-interim-site|remove-button|add-interim-site/
      )
      expect(result.match(/<form /g)).toHaveLength(
        (result.match(/data-testid="add-to-accreditation-/g) ?? []).length
      )
    })

    test('links back to the manage page and home to the Re/Ex material page', () => {
      expect(result).toMatch(
        new RegExp(`href="${MANAGE_URL}"[^>]*data-testid="back-link"`)
      )
      expect(result).toMatch(
        new RegExp(
          `href="${MANAGE_REEX_URL}"[^>]*data-testid="return-to-home-link"[^>]*>\\s*Return to home\\s*<`
        )
      )
    })
  })

  test('falls back to the first part of the flattened address when there is no address line 1', async () => {
    const result = await getPage(
      makeApp({
        overseasSites: {
          sites: [
            ors(1, {
              addressLine1: null,
              siteAddress: 'Hafenstrasse 9, Hamburg',
              country: 'Germany'
            })
          ]
        }
      })
    )

    expect(result).toMatch(
      /data-testid="accredited-site-address-1"[^>]*>\s*Hafenstrasse 9, Germany\s*</
    )
  })

  const TAB_LABELS = { accredited: 'Accredited', registered: 'Registered' }

  test.each([
    ['both tabs', [], ['accredited', 'registered']],
    ['only Accredited', [ors(4, { selected: false })], ['accredited']],
    ['only Registered', [ors(1)], ['registered']],
    ['neither tab', SITES, []]
  ])(
    'shows the empty message, naming the year, without the intro, on %s when it has no ORSs',
    async (_case, sites, emptyTabs) => {
      const result = await getPage(
        makeApp({ overseasSites: { sectionStatus: 'Completed', sites } })
      )

      for (const [name, label] of Object.entries(TAB_LABELS)) {
        const emptyTestId = `data-testid="${name}-sites-empty"`
        if (emptyTabs.includes(name)) {
          expect(result).toMatch(
            new RegExp(
              `data-testid="${name}-sites-tab"[^>]*>\\s*${label} \\(0\\)\\s*<`
            )
          )
          const panel = tabPanel(result, name)
          expect(panel).toMatch(
            new RegExp(
              `${emptyTestId}[^>]*>\\s*You have no ${label.toLowerCase()} overseas reprocessing sites for 2027\\.\\s*<`
            )
          )
          expect(panel).not.toContain('app-ors-list__intro')
        } else {
          expect(result).not.toContain(emptyTestId)
          expect(tabPanel(result, name)).toContain('app-ors-list__intro')
        }
      }
    }
  )

  test('renders under the Welsh path with Welsh-prefixed links', async () => {
    mockManageGets([makeApp()])

    const { statusCode, result } = await get(WELSH_PAGE_URL)

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh] Manage overseas reprocessing sites')
    expect(result).toMatch(
      new RegExp(`href="/cy${MANAGE_URL}"[^>]*data-testid="back-link"`)
    )
    expect(result).toMatch(
      new RegExp(
        `href="${MANAGE_REEX_URL}"[^>]*data-testid="return-to-home-link"`
      )
    )
  })

  describe('with the frontend stub API', () => {
    beforeEach(() => {
      vi.useRealTimers()
      // RA-492: the accreditation-changes API is served by the persistent
      // stub only.
      vi.spyOn(apiClient, 'get').mockImplementation((url) =>
        url.startsWith('/api/v1/accreditation-changes/')
          ? persistentGet(url)
          : stubApiClient.get(url)
      )
      operatorCanAccessOrganisation.mockResolvedValue(true)
    })

    test('shows the stub exporter with accredited and registered ORSs and interim sites', async () => {
      const { statusCode, result } = await get(
        `/manage/${MANAGE_EXPORTER_ORG.orgId}/${MANAGE_EXPORTER_ORG.registrationId}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="accredited-sites-tab"[^>]*>\s*Accredited \(3\)\s*</
      )
      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(1\)\s*</
      )
      expect(result).toMatch(/Show interim sites \(2\)/)
      // Dragon Recyclers is registered only, so its interim site stays hidden.
      expect(tabPanel(result, 'registered')).not.toContain(
        'interim-sites-disclosure'
      )
      expect(result).not.toContain('Saigon Port Storage')
    })

    // RA-697 task 012: org 50021 has a registration and no accreditation.
    test('shows the registration-only exporter’s four registered ORSs, none accredited', async () => {
      const { statusCode, result } = await get(
        `/manage/${REGISTRATION_ONLY_ORG.orgId}/${REGISTRATION_ONLY_ORG.registrationId}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="accredited-sites-tab"[^>]*>\s*Accredited \(0\)\s*</
      )
      expect(tabPanel(result, 'accredited')).toContain(
        'data-testid="accredited-sites-empty"'
      )
      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(4\)\s*</
      )
      const registered = tabPanel(result, 'registered')
      for (const name of [
        'Porto Plasticos Lda',
        'Milano Riciclo SpA',
        'Penang Polymers Sdn Bhd',
        'Jakarta Daur Ulang PT'
      ]) {
        expect(registered).toContain(name)
      }
      expect(result).not.toMatch(/add-to-accreditation-|view-request-|<form /)
      expect(result).not.toContain('Leixoes Port Storage')
    })

    // Org 50022: registered, with no accreditation and no registered ORSs.
    test('shows both tabs empty for the exporter with no overseas sites', async () => {
      const { statusCode, result } = await get(
        `/manage/${NO_OVERSEAS_SITES_ORG.orgId}/${NO_OVERSEAS_SITES_ORG.registrationId}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      for (const name of ['accredited', 'registered']) {
        expect(tabPanel(result, name)).toContain(
          `data-testid="${name}-sites-empty"`
        )
      }
      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(0\)\s*</
      )
    })
  })

  // RA-492: the operator's in-year requests to add registered ORSs.
  describe('in-year change requests', () => {
    const REQUESTS_URL =
      '/accreditation/manage-overseas-sites/app-current/requests'
    const changes = (statusBySiteId, activeSites = []) => ({
      ...noChangeRequests,
      sites: Object.entries(statusBySiteId).map(([siteId, status]) => ({
        siteId: Number(siteId),
        pendingRequestStatus: status
      })),
      activeRequest: activeSites.length
        ? { status: 'InProgress', sites: activeSites }
        : null
    })

    async function getWithChanges(view) {
      const spy = mockManageGets([makeApp()], approvedRegistration, view)
      const response = await get(PAGE_URL)
      expect(response.statusCode).toBe(statusCodes.ok)
      return { result: response.result, spy }
    }

    test('reads the requests for the accreditation on the page', async () => {
      const { spy } = await getWithChanges(noChangeRequests)

      expect(spy).toHaveBeenCalledWith(
        '/api/v1/accreditation-changes/org-123/app-current'
      )
    })

    test('a registered ORS in no request offers Add to accreditation as a crumb-protected POST', async () => {
      const { result } = await getWithChanges(noChangeRequests)
      const registered = tabPanel(result, 'registered')

      expect(registered).toMatch(
        /action="\/accreditation\/manage-overseas-sites\/app-current\/sites\/4"[\s\S]*?name="crumb"[\s\S]*?data-testid="add-to-accreditation-4"/
      )
      expect(registered).toContain('data-testid="add-to-accreditation-5"')
      expect(tabPanel(result, 'accredited')).not.toContain(
        'add-to-accreditation-'
      )
      expect(result).not.toContain('data-testid="pending-change-banner"')
      expect(result).not.toContain('data-testid="requests-banner"')
    })

    test('AC10: a site in the in-progress request shows In progress and View, with the requests banner', async () => {
      const { result } = await getWithChanges(
        changes({ 4: 'InProgress' }, [{ siteId: 4 }])
      )
      const registered = tabPanel(result, 'registered')

      expect(registered).toMatch(
        /data-testid="site-status-tag-4"[^>]*>\s*In progress\s*</
      )
      expect(registered).toContain(
        'href="/accreditation/manage-overseas-sites/app-current/add/4" data-testid="view-request-4">View change requests<'
      )
      expect(registered).not.toContain('add-to-accreditation-4')
      expect(registered).toContain('data-testid="add-to-accreditation-5"')
      expect(result).toMatch(
        /data-testid="requests-banner"[\s\S]*In year change request[\s\S]*You currently have 1 change request ready for submission\.[\s\S]*href="\/accreditation\/manage-overseas-sites\/app-current\/requests" data-testid="view-requests-link">View change request</
      )
      expect(result).toContain(REQUESTS_URL)
    })

    // RA-697: e.g. a registration-only draft, which the accreditation's
    // journey can't open, so there's nothing to View.
    test('a site in progress in another draft shows In progress, with no View or Add to accreditation', async () => {
      const { result } = await getWithChanges(changes({ 4: 'InProgress' }))
      const registered = tabPanel(result, 'registered')

      expect(registered).toMatch(
        /data-testid="site-status-tag-4"[^>]*>\s*In progress\s*</
      )
      expect(registered).not.toContain('view-request-4')
      expect(registered).not.toContain('add-to-accreditation-4')
    })

    test('AC09: a site in a submitted request stays on the Registered tab as Pending, with no action, and the pending banner', async () => {
      const { result } = await getWithChanges(changes({ 5: 'Submitted' }))
      const registered = tabPanel(result, 'registered')

      expect(registered).toMatch(
        /data-testid="site-status-tag-5"[^>]*>\s*Pending\s*</
      )
      expect(registered).not.toContain('add-to-accreditation-5')
      expect(registered).not.toContain('view-request-5')
      expect(tabPanel(result, 'accredited')).not.toContain(
        'registered-site-row-5'
      )
      expect(result).toMatch(/Registered \(3\)/)
      expect(result).toMatch(
        /data-testid="pending-change-banner"[\s\S]*application to add 1 overseas reprocessing site to your accreditation\. You will not be able to apply for any other changes to this site /
      )
      expect(result).toMatch(
        /class="govuk-notification-banner app-notification-banner--full-width"[^>]*data-testid="pending-change-banner"/
      )
      expect(result).not.toContain('data-testid="requests-banner"')
    })

    test('both banners count several sites in the plural', async () => {
      const { result } = await getWithChanges(
        changes({ 4: 'Submitted', 5: 'Submitted', 7: 'InProgress' }, [
          { siteId: 7 },
          { siteId: 8 }
        ])
      )

      expect(result).toContain(
        'You currently have 2 change requests ready for submission.'
      )
      expect(result).toContain(
        'application to add 2 overseas reprocessing sites to your accreditation. You will not be able to apply for any other changes to these sites '
      )
    })

    test("renders RA-425's page without RA-492 actions when the requests cannot be retrieved", async () => {
      const { result } = await getWithChanges(
        apiError(statusCodes.internalServerError)
      )

      expect(result).toMatch(
        /data-testid="accredited-sites-tab"[^>]*>\s*Accredited \(3\)\s*</
      )
      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(3\)\s*</
      )
      expect(result).toContain('data-testid="registered-site-row-4"')
      expect(result).not.toMatch(
        /add-to-accreditation-|site-status-tag-|view-request-|pending-change-banner|requests-banner|<form /
      )
    })
  })

  // RA-697 task 012: an exporter with an Approved registration and no
  // Approved current-year accreditation.
  describe('registration only', () => {
    const REGISTRATION_VIEW_URL = `/api/v1/accreditation-changes/org-123/registrations/${REGISTRATION_ID}/${MATERIAL}`
    // The registration view: every registered ORS, none selected.
    const registrationView = (sites) => ({
      ...noChangeRequests,
      applicationId: null,
      accreditationReference: null,
      sites: sites.map(({ pendingRequestStatus = null, ...site }) => ({
        siteId: site.siteId,
        orsId: site.orsId,
        accreditationStatus: 'Registered',
        pendingRequestId: pendingRequestStatus ? 'req-1' : null,
        pendingRequestStatus,
        lockedFields: [],
        site
      }))
    })
    const REGISTERED_SITES = [
      ors(1, {
        selected: false,
        siteName: 'Porto Plasticos',
        country: 'Portugal',
        interimSites: [interimSite(10, { siteName: 'Leixoes Store' })]
      }),
      ors(2, { selected: false }),
      ors(3, { selected: false })
    ]

    // The accreditation session keys as the page's response goes out.
    let session = null
    beforeAll(() => {
      page.server.ext('onPreResponse', (request, h) => {
        if (request.path.endsWith('/overseas-sites')) {
          session = Object.fromEntries(
            Object.entries(ACCREDITATION_SESSION_KEYS).map(([name, key]) => [
              name,
              request.yar?.get(key) ?? null
            ])
          )
        }
        return h.continue
      })
    })
    beforeEach(() => {
      session = null
    })

    async function getRegistrationOnly(
      view = registrationView(REGISTERED_SITES)
    ) {
      const spy = mockManageGets([], registrationOnlyExporter, view)
      const response = await get(PAGE_URL)
      expect(response.statusCode).toBe(statusCodes.ok)
      return { result: response.result, spy }
    }

    test('reads the sites from the registration view', async () => {
      const { spy } = await getRegistrationOnly()

      expect(spy).toHaveBeenCalledWith(REGISTRATION_VIEW_URL)
    })

    test('captions the page from the registration', async () => {
      const { result } = await getRegistrationOnly()

      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Reg Only Exports Ltd \(2027, Plastic\)\s*</
      )
    })

    test('shows Accredited (0) with its empty state', async () => {
      const { result } = await getRegistrationOnly()

      expect(result).toMatch(
        /data-testid="accredited-sites-tab"[^>]*>\s*Accredited \(0\)\s*</
      )
      expect(tabPanel(result, 'accredited')).toContain(
        'data-testid="accredited-sites-empty"'
      )
    })

    test('lists every registered ORS with its name, ORS ID and address, without interim sites', async () => {
      const { result } = await getRegistrationOnly()
      const registered = tabPanel(result, 'registered')

      expect(result).toMatch(
        /data-testid="registered-sites-tab"[^>]*>\s*Registered \(3\)\s*</
      )
      for (const id of [1, 2, 3]) {
        expect(registered).toContain(`data-testid="registered-site-row-${id}"`)
      }
      expect(registered).toMatch(
        /data-testid="registered-site-orsid-1"[^>]*>\s*001\s*</
      )
      expect(registered).toMatch(
        /data-testid="registered-site-name-1"[^>]*>\s*Porto Plasticos\s*</
      )
      expect(registered).toMatch(
        /data-testid="registered-site-address-1"[^>]*>\s*1 Industrieweg, Portugal\s*</
      )
      expect(result).not.toContain('interim-sites-disclosure')
      expect(result).not.toContain('Leixoes Store')
    })

    test('lists an ORS on Registered even if the view marks it selected', async () => {
      const { result } = await getRegistrationOnly(
        registrationView([ors(1), ors(2, { selected: false })])
      )

      expect(result).toMatch(/Accredited \(0\)/)
      expect(tabPanel(result, 'registered')).toContain(
        'data-testid="registered-site-row-1"'
      )
    })

    test('offers no "Add to accreditation" on any ORS', async () => {
      const { result } = await getRegistrationOnly()

      expect(result).not.toMatch(/add-to-accreditation-|<form /)
    })

    test('shows a submitted ORS as Pending, from the data', async () => {
      const { result } = await getRegistrationOnly(
        registrationView(
          REGISTERED_SITES.map((site) => ({
            ...site,
            pendingRequestStatus: site.siteId === 2 ? 'Submitted' : null
          }))
        )
      )

      expect(tabPanel(result, 'registered')).toMatch(
        /data-testid="site-status-tag-2"[^>]*>\s*Pending\s*</
      )
      expect(result).toContain('data-testid="pending-change-banner"')
      expect(result).not.toMatch(/add-to-accreditation-|<form /)
    })

    test('words the pending banner for the registration, not an accreditation', async () => {
      const { result } = await getRegistrationOnly(
        registrationView(
          REGISTERED_SITES.map((site) => ({
            ...site,
            pendingRequestStatus: site.siteId === 2 ? 'Submitted' : null
          }))
        )
      )

      expect(result).toContain(
        'Your regulator is reviewing your application to add 1 overseas reprocessing site to your registration. You will not be able to apply for any other changes to this site until your regulator makes their decision.'
      )
      expect(result).not.toContain('to your accreditation')
    })

    test('words the registration pending banner in the plural for several sites', async () => {
      const { result } = await getRegistrationOnly(
        registrationView(
          REGISTERED_SITES.map((site) => ({
            ...site,
            pendingRequestStatus: site.siteId === 1 ? null : 'Submitted'
          }))
        )
      )

      expect(result).toContain(
        'Your regulator is reviewing your application to add 2 overseas reprocessing sites to your registration. You will not be able to apply for any other changes to these sites until your regulator makes their decisions.'
      )
    })

    // RA-492's View link and requests link have no registration-only page yet.
    test('shows an in-progress ORS as In progress, without View or the requests link', async () => {
      const { result } = await getRegistrationOnly({
        ...registrationView(
          REGISTERED_SITES.map((site) => ({
            ...site,
            pendingRequestStatus: site.siteId === 3 ? 'InProgress' : null
          }))
        ),
        activeRequest: { status: 'InProgress', sites: [{ siteId: 3 }] }
      })

      expect(tabPanel(result, 'registered')).toMatch(
        /data-testid="site-status-tag-3"[^>]*>\s*In progress\s*</
      )
      expect(result).toContain('data-testid="requests-banner"')
      expect(result).not.toMatch(
        /view-request-|view-requests-link|manage-overseas-sites\/null/
      )
    })

    test('sets no accreditation session keys', async () => {
      await getRegistrationOnly()

      expect(session).toMatchObject({
        accreditationId: null,
        organisationId: null,
        registrationId: null,
        materialType: null,
        year: null
      })
    })

    test('an accredited exporter’s page still sets them', async () => {
      mockManageGets([makeApp()])

      const { statusCode } = await get(PAGE_URL)

      expect(statusCode).toBe(statusCodes.ok)
      expect(session).toMatchObject({
        accreditationId: 'app-current',
        organisationId: 'org-123',
        registrationId: REGISTRATION_ID,
        materialType: MATERIAL,
        year: CURRENT_YEAR
      })
    })

    test('returns 404 for a registration-only reprocessor', async () => {
      const spy = mockManageGets([], registrationOnlyReprocessor)

      const { statusCode } = await get(
        `/manage/org-123/${REGISTRATION_ID}/Glass/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.notFound)
      expect(spy).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/v1\/accreditation-changes\//)
      )
    })
  })
})
