import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import { persistentStubApiClient } from '../../common/persistentStubApiClient.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_REGISTRATION_NUMBER as REGISTRATION_NUMBER,
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
  REGISTRATION_ONLY_ORG,
  exporterRegistrationNumber
} from '../../common/constants/test-orgs.js'
import { currentYear } from '../../common/helpers/currentYear.js'

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

  // The HTML of one table row, by the ORS's internal site ID.
  function siteRow(html, siteId) {
    const start = html.indexOf(`data-testid="site-row-${siteId}"`)
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('</tr>', start))
  }

  // The row's cells, in column order: Site name, Status, Actions.
  function cells(row) {
    return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (match) => match[1]
    )
  }

  const actions = (html, siteId) => cells(siteRow(html, siteId))[2]

  const rowIds = (html) =>
    [...html.matchAll(/data-testid="site-row-(\d+)"/g)].map((match) =>
      Number(match[1])
    )

  function disclosure(html, orsSiteId) {
    const start = html.indexOf(
      `data-testid="interim-sites-disclosure-${orsSiteId}"`
    )
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('</details>', start))
  }

  // RA-814: by ORS ID, not the internal site ID, whatever the status.
  test('lists every site in one table by ORS ID, numerically, with blank and non-numeric IDs last by site ID', async () => {
    const html = await getPage(
      makeApp({
        overseasSites: {
          sectionStatus: 'Completed',
          sites: [
            ors(9, { selected: true, orsId: '2' }),
            ors(8, { selected: false, orsId: 'abc' }),
            ors(2, { selected: false, orsId: '10' }),
            ors(5, { selected: true, orsId: '001' }),
            ors(3, { selected: false, orsId: '' }),
            ors(1, { selected: true, orsId: null }),
            ors(4, { selected: false, orsId: '9' })
          ]
        }
      })
    )

    expect(html.match(/data-testid="overseas-sites-table"/g)).toHaveLength(1)
    expect(rowIds(html)).toEqual([5, 9, 4, 2, 1, 3, 8])
  })

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
      `/manage/not-my-org/${REGISTRATION_NUMBER}/${MATERIAL}/overseas-sites`
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

  test('returns 404 for a reprocessor accreditation whose registration is not Approved', async () => {
    mockManageGets([makeApp({ wasteProcessingType: 'reprocessor' })], {
      ...approvedRegistration,
      status: 'Created'
    })

    const { statusCode } = await get(PAGE_URL)

    expect(statusCode).toBe(statusCodes.notFound)
  })

  // RA-739: the accreditation is found by the registration's ReEx id, which
  // only the registration's record gives.
  test('is a 404 when the registration number has no record for the organisation', async () => {
    const spy = mockManageGets(
      [makeApp({ wasteProcessingType: 'reprocessor' })],
      apiError(statusCodes.notFound)
    )

    const { statusCode } = await get(PAGE_URL)

    expect(statusCode).toBe(statusCodes.notFound)
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/accreditation-applications\//)
    )
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }) {
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toMatch(
        new RegExp(`href="${PAGE_URL}"[^>]*data-testid="try-again-link"`)
      )
    }

    // RA-697: a registration-only exporter's sites come from the same view
    // as its change requests, so without it the list would be empty.
    test('rather than an empty list when a registration-only exporter’s view cannot be read', async () => {
      mockManageGets(
        [],
        registrationOnlyExporter,
        apiError(statusCodes.internalServerError)
      )

      const response = await get(PAGE_URL)

      expectServiceProblem(response)
      expect(response.result).not.toContain('overseas-sites-table')
    })

    test.each(['Created', 'Rejected', 'Cancelled'])(
      'when the registration is %s',
      async (status) => {
        mockManageGets([makeApp()], { ...approvedRegistration, status })

        expectServiceProblem(await get(PAGE_URL))
      }
    )

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
      'rather than an empty list when the accreditation %s',
      async (_case, overrides) => {
        mockManageGets([makeApp(overrides)])

        const response = await get(PAGE_URL)

        expectServiceProblem(response)
        expect(response.result).not.toContain('overseas-sites-table')
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

    test('shows one table with Site name, Status and Actions columns, and no tabs', () => {
      expect(result).toMatch(
        /data-testid="overseas-sites-table"[\s\S]*?<th[^>]*>\s*Site name\s*<\/th>\s*<th[^>]*>\s*Status\s*<\/th>\s*<th[^>]*>\s*Actions\s*<\/th>/
      )
      expect(result).not.toMatch(
        /govuk-tabs|sites-tab"|sites-panel|(accredited|registered)-sites-empty/
      )
      expect(result).not.toMatch(
        /(Accredited|Registered) overseas reprocessing sites/
      )
    })

    test('introduces the page for an operator with an accreditation', () => {
      expect(result).toMatch(
        /data-testid="overseas-sites-intro"[^>]*>\s*You can add new overseas reprocessing sites, change existing site details or withdraw sites from your accreditation\.\s*</
      )
    })

    test('tags selected ORSs Approved in green and the other existing ORSs Registered in grey, hiding unselected new sites', () => {
      for (const id of [1, 2, 3]) {
        expect(cells(siteRow(result, id))[1]).toMatch(
          new RegExp(
            `class="govuk-tag govuk-tag--green"[^>]*data-testid="ors-status-tag-${id}"[^>]*>\\s*Approved\\s*<`
          )
        )
      }
      // 7 has no selected value: only an explicit selection is approved.
      for (const id of [4, 5, 7]) {
        expect(cells(siteRow(result, id))[1]).toMatch(
          new RegExp(
            `class="govuk-tag govuk-tag--grey"[^>]*data-testid="ors-status-tag-${id}"[^>]*>\\s*Registered\\s*<`
          )
        )
      }
      expect(result).not.toContain('site-row-6"')
      expect(rowIds(result)).toEqual([1, 2, 3, 4, 5, 7])
    })

    test('says Approved, never Accredited', () => {
      expect(result).not.toMatch(/accredited/i)
    })

    test('shows each ORS number, name in bold, and "address line 1, country" in the Site name cell', () => {
      const [siteName] = cells(siteRow(result, 1))
      expect(siteName).toMatch(/data-testid="site-orsid-1"[^>]*>\s*001\s*</)
      expect(siteName).toMatch(
        /<strong[^>]*data-testid="site-name-1"[^>]*>\s*Bharat Recycling\s*</
      )
      expect(siteName).toMatch(
        /data-testid="site-address-1"[^>]*>\s*1 Industrieweg, India\s*</
      )
      expect(result).toMatch(
        /<strong[^>]*data-testid="site-name-4"[^>]*>\s*Registered Only Ltd\s*</
      )
      expect(result).toMatch(
        /data-testid="site-address-4"[^>]*>\s*4 Industrieweg, Netherlands\s*</
      )
    })

    test('shows no dates', () => {
      const table = result.slice(
        result.indexOf('data-testid="overseas-sites-table"'),
        result.indexOf('</table>')
      )
      expect(table).not.toMatch(/2026|Valid/)
    })

    // RA-814: approved rows get their actions from RA-682 (Change) and,
    // later, RA-676 (Withdraw).
    test('offers only Change on an approved row in no request', () => {
      for (const id of [1, 2, 3]) {
        const row = siteRow(result, id)
        expect(cells(row)).toHaveLength(3)
        expect(cells(row)[2]).toContain(`data-testid="change-site-${id}"`)
        expect(cells(row)[2]).not.toMatch(/<form |site-status-tag-/)
      }
    })

    test('lists current interim sites as "name, country, R-codes", leaving out removed ones', () => {
      const ors1 = disclosure(result, 1)

      expect(ors1).toMatch(/Interim sites \(2\)/)
      expect(ors1).toMatch(
        /data-testid="interim-site-row-10"[\s\S]*?Interim 10<\/span>, <span[^>]*>Belgium<\/span>, <span[^>]*>R3, R13</
      )
      expect(ors1).toContain('data-testid="interim-site-row-50"')
      expect(ors1).not.toContain('Interim 11')
    })

    // RA-814: one label, open or closed, so no Show/Hide wording.
    test('labels the collapsed interim disclosure "Interim sites (n)"', () => {
      expect(result).toMatch(
        /data-testid="interim-sites-disclosure-summary-1"[^>]*>\s*Interim sites \(2\)\s*</
      )
      expect(result).not.toMatch(
        /<details(?=[^>]*data-testid="interim-sites-disclosure-1")[^>]*\bopen\b/
      )
      expect(result).not.toMatch(/(Show|Hide) interim sites/)
    })

    test('shows a shared interim site under every ORS where it is current', () => {
      expect(disclosure(result, 1)).toContain('Shared Hub')
      expect(disclosure(result, 2)).toContain('Shared Hub')
      expect(disclosure(result, 2)).toMatch(/Interim sites \(1\)/)
    })

    test('shows no disclosure for an ORS with no current interim sites', () => {
      expect(result).not.toContain('interim-sites-disclosure-3"')
    })

    test('puts the interim disclosure in the Site name cell, for registered ORSs too', () => {
      for (const [id, name] of [
        [1, 'Interim 10'],
        [4, 'Registration Interim']
      ]) {
        const [siteName] = cells(siteRow(result, id))
        expect(siteName).toContain(`interim-sites-disclosure-${id}"`)
        expect(siteName).toContain(name)
      }
    })

    // RA-492's "Add to accreditation" on registered ORSs and RA-682's Change on
    // approved ones are the only actions. RA-814: the design's Add, Withdraw,
    // Remove and a registered ORS's Change belong to later tickets.
    test('has no Add buttons, withdraw, remove, registered Change or interim-site actions', () => {
      expect(result).not.toMatch(
        /change-interim-site|remove-button|add-interim-site/
      )
      expect(result).not.toMatch(/>\s*(Withdraw|Remove)\s*</)
      expect(result.match(/data-testid="change-site-\d+"/g)).toEqual([
        'data-testid="change-site-1"',
        'data-testid="change-site-2"',
        'data-testid="change-site-3"'
      ])
      expect(result).not.toContain('Add a new overseas reprocessing site')
      expect(result).not.toContain('govuk-button')
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
      /data-testid="site-address-1"[^>]*>\s*Hafenstrasse 9, Germany\s*</
    )
  })

  test.each([
    ['no sites', []],
    [
      'only an unselected new site',
      [ors(6, { selected: false, isNewSite: true })]
    ]
  ])(
    'shows the intro and the empty message, with no table, for %s',
    async (_case, sites) => {
      const result = await getPage(
        makeApp({ overseasSites: { sectionStatus: 'Completed', sites } })
      )

      expect(result).toContain('data-testid="overseas-sites-intro"')
      expect(result).toMatch(
        /data-testid="overseas-sites-empty"[^>]*>\s*You have no overseas reprocessing sites\.\s*</
      )
      expect(result).not.toMatch(
        /overseas-sites-table|<table|site-row-|overseas-sites-count|govuk-pagination/
      )
      expect(result).toContain('data-testid="return-to-home-link"')
    }
  )

  test.each([
    ['only approved', [ors(1), ors(2)]],
    ['only registered', [ors(4, { selected: false })]]
  ])(
    'lists the sites, without the empty message, when there are %s ORSs',
    async (_case, sites) => {
      const result = await getPage(
        makeApp({ overseasSites: { sectionStatus: 'Completed', sites } })
      )

      expect(rowIds(result)).toEqual(sites.map((site) => site.siteId))
      expect(result).not.toContain('overseas-sites-empty')
      expect(result).toMatch(/<th[^>]*>\s*Actions\s*<\/th>/)
    }
  )

  test('renders under the Welsh path with Welsh-prefixed links', async () => {
    mockManageGets([makeApp()])

    const { statusCode, result } = await get(WELSH_PAGE_URL)

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh] Manage overseas reprocessing sites')
    expect(result).toMatch(/\[Welsh\] Interim sites \(2\)/)
    expect(result).toContain(
      '[Welsh] You can add new overseas reprocessing sites, change existing site details or withdraw sites from your accreditation.'
    )
    expect(result).toMatch(/<th[^>]*>\s*\[Welsh\] Site name\s*<\/th>/)
    expect(result).toMatch(
      /data-testid="ors-status-tag-1"[^>]*>\s*\[Welsh\] Approved\s*</
    )
    expect(result).toMatch(
      /data-testid="ors-status-tag-4"[^>]*>\s*\[Welsh\] Registered\s*</
    )
    expect(result).toMatch(
      new RegExp(`href="/cy${MANAGE_URL}"[^>]*data-testid="back-link"`)
    )
    expect(result).toMatch(
      new RegExp(
        `href="${MANAGE_REEX_URL}"[^>]*data-testid="return-to-home-link"`
      )
    )
  })

  // RA-814: ten sites a page, as the Change requests page pages its list.
  describe('count line and paging', () => {
    const APPLICATION_ID = 'app-current'
    // 23 sites whose ORS IDs run opposite to their site IDs, so the list is
    // only in ORS ID order across pages if it is ordered before it is paged.
    // Even site IDs are approved, odd ones registered.
    const MANY_SITES = Array.from({ length: 23 }, (_, index) => {
      const siteId = index + 1
      return ors(siteId, {
        orsId: String(24 - siteId).padStart(3, '0'),
        selected: siteId % 2 === 0
      })
    })
    const sitesApp = (sites) =>
      makeApp({ overseasSites: { sectionStatus: 'Completed', sites } })
    const siteIdsFrom = (from, to) =>
      Array.from({ length: from - to + 1 }, (_, index) => from - index)

    async function getListPage(
      query,
      { sites = MANY_SITES, changes = noChangeRequests, url = PAGE_URL } = {}
    ) {
      mockManageGets([sitesApp(sites)], approvedRegistration, changes)
      const response = await get(`${url}${query}`)
      expect(response.statusCode).toBe(statusCodes.ok)
      return response
    }

    const countLine = (html) =>
      html.match(
        /<p[^>]*data-testid="overseas-sites-count"[^>]*>\s*([^<]+?)\s*<\/p>/
      )?.[1]

    const paginationLinks = (html) =>
      [
        ...html.matchAll(
          /class="govuk-link govuk-pagination__link" href="([^"]+)"(?: rel="(prev|next)")?/g
        )
      ].map(([, href, rel]) => [rel ?? 'page', href.replaceAll('&amp;', '&')])

    test.each([
      [6, SITES, 'Showing 1-6 of 6'],
      [10, MANY_SITES.slice(0, 10), 'Showing 1-10 of 10']
    ])(
      'shows all %i sites under a normal weight count line, with no pagination',
      async (count, sites, text) => {
        const { result } = await getListPage('', { sites })

        expect(rowIds(result)).toHaveLength(count)
        expect(countLine(result)).toBe(text)
        expect(result).toMatch(
          new RegExp(
            `<p class="govuk-body" data-testid="overseas-sites-count">\\s*${text}\\s*</p>`
          )
        )
        expect(result).not.toContain('govuk-pagination')
      }
    )

    test('marks the pagination for tests when there is more than one page', async () => {
      const { result } = await getListPage('')

      expect(result).toMatch(
        /<nav class="govuk-pagination"[^>]*data-testid="overseas-sites-pagination"/
      )
    })

    test('puts the count line above the table', async () => {
      const { result } = await getListPage('')
      const count = result.indexOf('data-testid="overseas-sites-count"')

      expect(count).toBeGreaterThan(-1)
      expect(count).toBeLessThan(
        result.indexOf('data-testid="overseas-sites-table"')
      )
    })

    test('shows the first ten sites by ORS ID, with pagination, when there are more', async () => {
      const { result } = await getListPage('')

      expect(rowIds(result)).toEqual(siteIdsFrom(23, 14))
      expect(countLine(result)).toBe('Showing 1-10 of 23')
      expect(paginationLinks(result)).toEqual([
        ['page', `${PAGE_URL}?page=1`],
        ['page', `${PAGE_URL}?page=2`],
        ['page', `${PAGE_URL}?page=3`],
        ['next', `${PAGE_URL}?page=2`]
      ])
      expect(result).toMatch(
        new RegExp(
          `href="${PAGE_URL}\\?page=1" aria-label="Page 1" aria-current="page"`
        )
      )
    })

    test('continues in ORS ID order on later pages, with the right ranges', async () => {
      const second = (await getListPage('?page=2')).result
      const third = (await getListPage('?page=3')).result

      expect(rowIds(second)).toEqual(siteIdsFrom(13, 4))
      expect(countLine(second)).toBe('Showing 11-20 of 23')
      expect(paginationLinks(second)).toEqual([
        ['prev', `${PAGE_URL}?page=1`],
        ['page', `${PAGE_URL}?page=1`],
        ['page', `${PAGE_URL}?page=2`],
        ['page', `${PAGE_URL}?page=3`],
        ['next', `${PAGE_URL}?page=3`]
      ])
      expect(rowIds(third)).toEqual([3, 2, 1])
      expect(countLine(third)).toBe('Showing 21-23 of 23')
      expect(paginationLinks(third).at(-1)).toEqual([
        'page',
        `${PAGE_URL}?page=3`
      ])
    })

    test('names the Previous and Next links and each page to screen readers', async () => {
      const { result } = await getListPage('?page=2')

      expect(result).toContain('aria-label="Pagination"')
      expect(result).toContain('aria-label="Page 3"')
      expect(result).toMatch(
        /rel="prev"[\s\S]*?Previous<span class="govuk-visually-hidden"> page<\/span>/
      )
      expect(result).toMatch(
        /rel="next"[\s\S]*?Next<span class="govuk-visually-hidden"> page<\/span>/
      )
    })

    test.each([
      ['a page past the last', '?page=99', 21, 23],
      ['page 0', '?page=0', 1, 10],
      ['a page that is not a number', '?page=last', 1, 10]
    ])('shows a valid page for %s', async (_case, query, from, to) => {
      const { result } = await getListPage(query)

      expect(countLine(result)).toBe(`Showing ${from}-${to} of 23`)
      expect(rowIds(result)).toHaveLength(to - from + 1)
    })

    test('keeps the Welsh prefix and labels in the count line and pagination', async () => {
      const { result } = await getListPage('?page=2', { url: WELSH_PAGE_URL })

      expect(countLine(result)).toBe('[Welsh] Showing 11-20 of 23')
      expect(paginationLinks(result)).toEqual([
        ['prev', `/cy${PAGE_URL}?page=1`],
        ['page', `/cy${PAGE_URL}?page=1`],
        ['page', `/cy${PAGE_URL}?page=2`],
        ['page', `/cy${PAGE_URL}?page=3`],
        ['next', `/cy${PAGE_URL}?page=3`]
      ])
      expect(result).toContain('aria-label="[Welsh] Pagination"')
      expect(result).toContain('aria-label="[Welsh] Page 3"')
      expect(result).toMatch(
        /rel="prev"[\s\S]*?\[Welsh\] Previous<span class="govuk-visually-hidden"> \[Welsh\] page<\/span>/
      )
    })

    // Worked out from the whole list, so the same on every page. The pending
    // banner gives way to the requests banner, so each is checked alone.
    test.each(['', '?page=2', '?page=3'])(
      'counts pending sites across all pages (%s)',
      async (query) => {
        const changes = {
          ...noChangeRequests,
          sites: [
            // Page 1 and page 3.
            { siteId: 21, pendingRequestStatus: 'Submitted' },
            { siteId: 3, pendingRequestStatus: 'Submitted' }
          ]
        }

        const { result } = await getListPage(query, { changes })

        expect(result).toContain(
          'your applications for 2 overseas reprocessing sites.'
        )
      }
    )

    test.each(['', '?page=2', '?page=3'])(
      'counts ready requests on every page (%s)',
      async (query) => {
        const changes = {
          ...noChangeRequests,
          sites: [
            // Page 2.
            { siteId: 9, pendingRequestStatus: 'InProgress' }
          ],
          activeRequest: { status: 'InProgress', sites: [{ siteId: 9 }] }
        }

        const { result } = await getListPage(query, { changes })

        expect(result).toContain(
          'You currently have 1 change request ready for submission.'
        )
      }
    )

    test('Add to accreditation works for a site on page 2, on a first visit straight to that page', async () => {
      const { result, headers } = await getListPage('?page=2')
      const action = `/accreditation/manage-overseas-sites/${APPLICATION_ID}/sites/13`
      expect(actions(result, 13)).toContain(`action="${action}"`)

      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const cookie = [headers['set-cookie']]
        .flat()
        .map((value) => value.split(';')[0])
        .join('; ')
      const response = await page.server.inject({
        method: 'POST',
        url: action,
        headers: { cookie }
      })

      expect(post).toHaveBeenCalledWith(
        `/api/v1/accreditation-changes/reex-org-123/${APPLICATION_ID}/requests/current/sites`,
        { siteId: 13 }
      )
      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(
        `/accreditation/manage-overseas-sites/${APPLICATION_ID}/add/13`
      )
    })
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

    const statusTags = (html, label) =>
      html.match(
        new RegExp(
          `data-testid="ors-status-tag-\\d+"[^>]*>\\s*${label}\\s*<`,
          'g'
        )
      ) ?? []

    test('shows the stub exporter with approved and registered ORSs and interim sites', async () => {
      const { statusCode, result } = await get(
        `/manage/${MANAGE_EXPORTER_ORG.orgId}/${exporterRegistrationNumber(currentYear(), MANAGE_EXPORTER_ORG.orgId)}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(statusTags(result, 'Approved')).toHaveLength(3)
      expect(statusTags(result, 'Registered')).toHaveLength(1)
      expect(result).toMatch(/Interim sites \(2\)/)
      // Dragon Recyclers is registered only, and its interim site shows too.
      expect(result).toContain('Saigon Port Storage')
    })

    // RA-697 task 012: org 50021 has a registration and no accreditation.
    test('shows the registration-only exporter’s four registered ORSs, none approved', async () => {
      const { statusCode, result } = await get(
        `/manage/${REGISTRATION_ONLY_ORG.orgId}/${exporterRegistrationNumber(currentYear(), REGISTRATION_ONLY_ORG.orgId)}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(statusTags(result, 'Approved')).toHaveLength(0)
      expect(statusTags(result, 'Registered')).toHaveLength(4)
      for (const name of [
        'Porto Plasticos Lda',
        'Milano Riciclo SpA',
        'Penang Polymers Sdn Bhd',
        'Jakarta Daur Ulang PT'
      ]) {
        expect(result).toContain(name)
      }
      expect(result).not.toMatch(/add-to-accreditation-|view-request-|<form /)
      expect(result).toContain('Leixoes Port Storage')
    })

    // Org 50022: registered, with no accreditation and no registered ORSs.
    test('shows the empty message for the exporter with no overseas sites', async () => {
      const { statusCode, result } = await get(
        `/manage/${NO_OVERSEAS_SITES_ORG.orgId}/${exporterRegistrationNumber(currentYear(), NO_OVERSEAS_SITES_ORG.orgId)}/Plastic/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="overseas-sites-empty"')
      expect(result).not.toContain('overseas-sites-table')
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
        '/api/v1/accreditation-changes/reex-org-123/app-current'
      )
    })

    test('a registered ORS in no request offers Add to accreditation as a crumb-protected POST, naming the site to screen readers', async () => {
      const { result } = await getWithChanges(noChangeRequests)

      expect(actions(result, 4)).toMatch(
        /action="\/accreditation\/manage-overseas-sites\/app-current\/sites\/4"[\s\S]*?name="crumb"[\s\S]*?data-testid="add-to-accreditation-4">\s*Add to accreditation<span class="govuk-visually-hidden"> Registered Only Ltd<\/span>/
      )
      expect(actions(result, 5)).toContain(
        'data-testid="add-to-accreditation-5"'
      )
      for (const id of [1, 2, 3]) {
        expect(actions(result, id)).not.toContain(`add-to-accreditation-${id}`)
      }
      expect(result).not.toContain('data-testid="pending-change-banner"')
      expect(result).not.toContain('data-testid="requests-banner"')
    })

    test.each(['Rejected', 'Withdrawn'])(
      'a registered ORS whose request was %s offers Add to accreditation again',
      async (status) => {
        const { result } = await getWithChanges(changes({ 4: status }))

        expect(actions(result, 4)).toContain(
          'data-testid="add-to-accreditation-4"'
        )
        expect(actions(result, 4)).not.toContain('site-status-tag-4')
      }
    )

    // RA-814: a change request never moves a site between Approved and
    // Registered; it only sets the row's change tag (RA-682 on approved rows).
    test('a change request on a site never changes its status', async () => {
      const { result } = await getWithChanges(
        changes({ 1: 'Submitted', 2: 'InProgress', 5: 'Submitted' }, [
          { siteId: 2 }
        ])
      )

      for (const id of [1, 2]) {
        expect(cells(siteRow(result, id))[1]).toMatch(/>\s*Approved\s*</)
      }
      expect(cells(siteRow(result, 5))[1]).toMatch(/>\s*Registered\s*</)
    })

    test('RA-682: an approved ORS in no request offers Change, to its details page', async () => {
      const { result } = await getWithChanges(noChangeRequests)

      expect(actions(result, 1)).toContain(
        'href="/accreditation/manage-overseas-sites/app-current/update/1" data-testid="change-site-1"'
      )
      expect(actions(result, 1)).not.toContain('site-status-tag-1')
      expect(actions(result, 1)).not.toContain('add-to-accreditation-1')
    })

    test('RA-682 AC03: an approved ORS a submitted request holds shows Pending, with no Change', async () => {
      const { result } = await getWithChanges(changes({ 1: 'Submitted' }))

      expect(actions(result, 1)).toMatch(
        /data-testid="site-status-tag-1"[^>]*>\s*Pending\s*</
      )
      expect(actions(result, 1)).not.toContain('data-testid="change-site-1"')
      expect(actions(result, 2)).toContain('data-testid="change-site-2"')
    })

    test('RA-682: an approved ORS whose change is in the draft shows In progress and View, to its details, with no Change', async () => {
      const { result } = await getWithChanges(
        changes({ 1: 'InProgress' }, [{ siteId: 1 }])
      )

      expect(actions(result, 1)).toMatch(
        /data-testid="site-status-tag-1"[^>]*>\s*In progress\s*</
      )
      expect(actions(result, 1)).toContain(
        'href="/accreditation/manage-overseas-sites/app-current/update/1" data-testid="view-request-1"'
      )
      expect(actions(result, 1)).not.toContain('data-testid="change-site-1"')
    })

    test('a registered ORS never offers Change', async () => {
      const { result } = await getWithChanges(noChangeRequests)

      expect(actions(result, 4)).not.toContain('change-site-4')
    })

    test('AC10: a site in the in-progress request shows In progress and View, with the requests banner', async () => {
      const { result } = await getWithChanges(
        changes({ 4: 'InProgress' }, [{ siteId: 4 }])
      )
      const registered = actions(result, 4)

      expect(registered).toMatch(
        /data-testid="site-status-tag-4"[^>]*>\s*In progress\s*</
      )
      expect(registered).toContain(
        'href="/accreditation/manage-overseas-sites/app-current/add/4" data-testid="view-request-4">View change requests<span class="govuk-visually-hidden"> Registered Only Ltd</span></a>'
      )
      expect(registered).not.toContain('add-to-accreditation-4')
      expect(actions(result, 5)).toContain(
        'data-testid="add-to-accreditation-5"'
      )
      expect(result).toMatch(
        /data-testid="requests-banner"[\s\S]*In year change request[\s\S]*You currently have 1 change request ready for submission\.[\s\S]*href="\/accreditation\/manage-overseas-sites\/app-current\/requests" data-testid="view-requests-link">View change request</
      )
      expect(result).toContain(REQUESTS_URL)
    })

    // RA-697: e.g. a registration-only draft, which the accreditation's
    // journey can't open, so there's nothing to View.
    test('a site in progress in another draft shows In progress, with no View or Add to accreditation', async () => {
      const { result } = await getWithChanges(changes({ 4: 'InProgress' }))
      const registered = actions(result, 4)

      expect(registered).toMatch(
        /data-testid="site-status-tag-4"[^>]*>\s*In progress\s*</
      )
      expect(registered).not.toContain('view-request-4')
      expect(registered).not.toContain('add-to-accreditation-4')
    })

    test('AC09: a site in a submitted request stays Registered, tagged Pending, with no action, and the pending banner', async () => {
      const { result } = await getWithChanges(changes({ 5: 'Submitted' }))
      const registered = actions(result, 5)

      expect(registered).toMatch(
        /data-testid="site-status-tag-5"[^>]*>\s*Pending\s*</
      )
      expect(registered).not.toContain('add-to-accreditation-5')
      expect(registered).not.toContain('view-request-5')
      expect(cells(siteRow(result, 5))[1]).toMatch(/>\s*Registered\s*</)
      expect(result).toMatch(
        /data-testid="pending-change-banner"[\s\S]*your application for 1 overseas reprocessing site\. You will not be able to apply for any other changes to this site /
      )
      expect(result).toMatch(
        /class="govuk-notification-banner app-notification-banner--full-width"[^>]*data-testid="pending-change-banner"/
      )
      expect(result).not.toContain('data-testid="requests-banner"')
    })

    // User, 2026-11-27: the requests banner replaces the pending banner when
    // both apply, so the page shows one.
    test('shows the requests banner in the plural, and not the pending banner as well', async () => {
      const { result } = await getWithChanges(
        changes({ 4: 'Submitted', 5: 'Submitted', 7: 'InProgress' }, [
          { siteId: 7 },
          { siteId: 8 }
        ])
      )

      expect(result).toContain(
        'You currently have 2 change requests ready for submission.'
      )
      expect(result).not.toContain('data-testid="pending-change-banner"')
      expect(actions(result, 4)).toMatch(
        /data-testid="site-status-tag-4"[^>]*>\s*Pending\s*</
      )
    })

    // User, 2026-11-27: one banner for every site the regulator is reviewing,
    // approved sites' updates (RA-682) and registered sites' additions alike.
    test('the pending banner counts approved and registered sites in submitted requests together', async () => {
      const { result } = await getWithChanges(
        changes({ 1: 'Submitted', 5: 'Submitted' })
      )

      expect(cells(siteRow(result, 1))[1]).toMatch(/>\s*Approved\s*</)
      expect(cells(siteRow(result, 5))[1]).toMatch(/>\s*Registered\s*</)
      expect(result).toMatch(
        /data-testid="pending-change-banner"[\s\S]*your applications for 2 overseas reprocessing sites\./
      )
    })

    test("marks each row's Actions cell for tests", async () => {
      const { result } = await getWithChanges(noChangeRequests)

      expect(result).toMatch(
        /<td class="govuk-table__cell app-ors-table__actions-cell" data-testid="site-actions-1">[\s\S]*?data-testid="change-site-1"/
      )
      expect(result).toMatch(
        /<td class="govuk-table__cell app-ors-table__actions-cell" data-testid="site-actions-4">[\s\S]*?data-testid="add-to-accreditation-4"/
      )
    })

    test("renders RA-425's page without RA-492 actions when the requests cannot be retrieved", async () => {
      const { result } = await getWithChanges(
        apiError(statusCodes.internalServerError)
      )

      expect(rowIds(result)).toEqual([1, 2, 3, 4, 5, 7])
      // Only the statuses, which come from the accreditation, remain.
      expect(result).toMatch(/data-testid="ors-status-tag-1"[^>]*>\s*Approved/)
      expect(result).toMatch(
        /data-testid="ors-status-tag-4"[^>]*>\s*Registered/
      )
      expect(result).not.toMatch(
        /add-to-accreditation-|site-status-tag-|view-request-|pending-change-banner|requests-banner|<form /
      )
    })
  })

  // RA-697 task 012: an exporter with an Approved registration and no
  // Approved current-year accreditation.
  describe('registration only', () => {
    const REGISTRATION_VIEW_URL = `/api/v1/accreditation-changes/reex-org-123/registrations/${REGISTRATION_ID}/${MATERIAL}`
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

    test('introduces the page without mentioning an accreditation', async () => {
      const { result } = await getRegistrationOnly()

      expect(result).toMatch(
        /data-testid="overseas-sites-intro"[^>]*>\s*You can add new overseas reprocessing sites or change existing site details\.\s*</
      )
    })

    test('shows the intro and the empty message, with no table, when the registration has no ORSs', async () => {
      const { result } = await getRegistrationOnly(registrationView([]))

      expect(result).toContain(
        'You can add new overseas reprocessing sites or change existing site details.'
      )
      expect(result).toContain('data-testid="overseas-sites-empty"')
      expect(result).not.toContain('overseas-sites-table')
    })

    test('lists every registered ORS by ORS ID with its name, address and interim sites', async () => {
      const { result } = await getRegistrationOnly(
        registrationView([
          REGISTERED_SITES[0],
          { ...REGISTERED_SITES[1], orsId: '010' },
          { ...REGISTERED_SITES[2], orsId: '002' }
        ])
      )

      expect(rowIds(result)).toEqual([1, 3, 2])
      const [siteName, status] = cells(siteRow(result, 1))
      expect(siteName).toMatch(/data-testid="site-orsid-1"[^>]*>\s*001\s*</)
      expect(siteName).toMatch(
        /data-testid="site-name-1"[^>]*>\s*Porto Plasticos\s*</
      )
      expect(siteName).toMatch(
        /data-testid="site-address-1"[^>]*>\s*1 Industrieweg, Portugal\s*</
      )
      expect(siteName).toContain('interim-sites-disclosure-1"')
      expect(siteName).toContain('Leixoes Store')
      expect(status).toMatch(/govuk-tag--grey[^>]*>\s*Registered\s*</)
    })

    test('tags an ORS Registered even if the view marks it selected', async () => {
      const { result } = await getRegistrationOnly(
        registrationView([ors(1), ors(2, { selected: false })])
      )

      expect(result).toMatch(
        /data-testid="ors-status-tag-1"[^>]*>\s*Registered\s*</
      )
      expect(result).not.toContain('Approved')
      expect(result).not.toContain('site-status-tag-1')
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

      expect(actions(result, 2)).toMatch(
        /data-testid="site-status-tag-2"[^>]*>\s*Pending\s*</
      )
      expect(result).toContain('data-testid="pending-change-banner"')
      expect(result).not.toMatch(/add-to-accreditation-|<form /)
    })

    test('words the pending banner the same for registration only', async () => {
      const { result } = await getRegistrationOnly(
        registrationView(
          REGISTERED_SITES.map((site) => ({
            ...site,
            pendingRequestStatus: site.siteId === 2 ? 'Submitted' : null
          }))
        )
      )

      expect(result).toContain(
        'Your regulator is reviewing your application for 1 overseas reprocessing site. You will not be able to apply for any other changes to this site until your regulator makes their decision.'
      )
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
        'Your regulator is reviewing your applications for 2 overseas reprocessing sites. You will not be able to apply for any other changes to these sites until your regulator makes their decisions.'
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

      expect(actions(result, 3)).toMatch(
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
        organisationId: 'reex-org-123',
        registrationId: REGISTRATION_ID,
        materialType: MATERIAL,
        year: CURRENT_YEAR
      })
    })

    // The add-ORS journey looks the material up by our names (Glass's
    // recycling operation codes), which have no glass_re_melt.
    test("sets the accreditation's own material, not the URL's", async () => {
      mockManageGets([
        makeApp({ material: 'glass', glassRecyclingProcess: ['glass_re_melt'] })
      ])

      const { statusCode } = await get(
        `/manage/org-123/${REGISTRATION_NUMBER}/glass_re_melt/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(session).toMatchObject({ materialType: 'Glass' })
    })

    test('returns 404 for a registration-only reprocessor', async () => {
      const spy = mockManageGets([], registrationOnlyReprocessor)

      const { statusCode } = await get(
        `/manage/org-123/${REGISTRATION_NUMBER}/Glass/overseas-sites`
      )

      expect(statusCode).toBe(statusCodes.notFound)
      expect(spy).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/v1\/accreditation-changes\//)
      )
    })
  })
})
