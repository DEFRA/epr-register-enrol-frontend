import { describe, test, expect, beforeEach, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_URL,
  MANAGE_REEX_URL,
  apiError,
  approvedRegistration,
  makeManageApp,
  mockManageGets
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'
import {
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_REGISTRATION_ID
} from '../../common/constants/test-orgs.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const PAGE_URL = `${MANAGE_URL}/overseas-sites`
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

    test('when there is no Approved current-year accreditation', async () => {
      mockManageGets([
        makeApp({ year: CURRENT_YEAR - 1 }),
        makeApp({ id: 'app-started', applicationStatus: 'Started' })
      ])

      expectServiceProblem(await get(PAGE_URL))
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
        'These are the registered overseas reprocessing sites (ORSs) that you can request to add as an accredited ORS for 2027.'
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

    test('is read-only: no change, withdraw or add actions', () => {
      expect(result).not.toMatch(
        /change-interim-site|remove-button|add-interim-site/
      )
      expect(result).not.toContain('<form')
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
    'shows the empty message on %s when it has no ORSs',
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
          expect(tabPanel(result, name)).toContain(emptyTestId)
        } else {
          expect(result).not.toContain(emptyTestId)
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
      vi.spyOn(apiClient, 'get').mockImplementation((url) =>
        stubApiClient.get(url)
      )
      operatorCanAccessOrganisation.mockResolvedValue(true)
    })

    test('shows the stub exporter with accredited and registered ORSs and interim sites', async () => {
      const { statusCode, result } = await get(
        `/manage/${MANAGE_EXPORTER_ORG_ID}/${MANAGE_EXPORTER_REGISTRATION_ID}/Plastic/overseas-sites`
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
  })
})
