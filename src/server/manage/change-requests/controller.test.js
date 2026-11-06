import { beforeEach, describe, test, expect, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import { persistentStubApiClient } from '../../common/persistentStubApiClient.js'
import {
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL,
  MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
  MANAGE_EXPORTER_REGISTRATION_ID,
  NO_CHANGE_REQUESTS_ORG_ID,
  NO_CHANGE_REQUESTS_REGISTRATION_ID
} from '../../common/constants/test-orgs.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_URL,
  MANAGE_REEX_URL,
  apiError,
  makeManageApp,
  mockManageGets,
  noChangeRequests
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const PAGE_URL = `${MANAGE_URL}/change-requests`
// Read before any test spies on apiClient, which in tests is this same client.
const persistentGet = persistentStubApiClient.get
const WELSH_PAGE_URL = `/cy${PAGE_URL}`

const SUBMITTER = { fullName: 'Sam Patel', email: 'sam.patel@example.com' }

const accreditationSite = (siteId, siteName, addressLine1, country) => ({
  siteId,
  orsId: String(siteId).padStart(3, '0'),
  accreditationStatus: 'Accredited',
  pendingRequestId: null,
  pendingRequestStatus: null,
  lockedFields: [],
  site: { siteId, siteName, addressLine1, country }
})

const orsItem = (itemId, siteId, siteName, changeType, status) => ({
  siteId,
  orsId: String(siteId).padStart(3, '0'),
  siteName,
  itemId,
  changeType,
  status,
  validFrom: null,
  withdrawnAt: null
})

const tonnageItem = (itemId, status) => ({
  itemId,
  changeType: 'upgrade-tonnage-band',
  status,
  validFrom: null,
  withdrawnAt: null,
  requestedBand: 'UpTo10000'
})

const submittedRequest = (requestId, submittedAt, items) => ({
  requestId,
  changeType: 'add-overseas-site',
  status: 'Submitted',
  createdAt: submittedAt,
  updatedAt: submittedAt,
  submittedAt,
  submittedBy: SUBMITTER,
  caseManagementReference: `CR-${requestId}`,
  sites: items.sites ?? [],
  tonnageBandUpgrade: items.tonnage ?? null
})

const CURRENT_VIEW = {
  ...noChangeRequests,
  sites: [
    accreditationSite(1, 'Bharat Recycling', '1 Industrial Road', 'India'),
    accreditationSite(2, 'Paris Paper', '2 Rue du Port', 'France'),
    accreditationSite(3, 'Berlin Polymers', '3 Hafenstrasse', 'Germany'),
    accreditationSite(4, 'Dragon Plastics', '4 Harbour Way', 'Vietnam')
  ],
  requests: [
    {
      ...submittedRequest('draft', null, {
        sites: [
          orsItem(
            'item-in-progress',
            4,
            'Dragon Plastics',
            'add-overseas-site',
            'InProgress'
          )
        ]
      }),
      status: 'InProgress',
      createdAt: '2027-05-01T09:00:00Z',
      updatedAt: '2027-05-02T09:00:00Z',
      submittedBy: null,
      caseManagementReference: null
    },
    submittedRequest('r4', '2027-04-15T09:00:00Z', {
      sites: [
        orsItem(
          'item-updated',
          3,
          'Berlin Polymers',
          'update-overseas-site',
          'Updated'
        )
      ]
    }),
    submittedRequest('r3', '2027-04-01T09:00:00Z', {
      tonnage: tonnageItem('item-tonnage', 'DulyMade')
    }),
    submittedRequest('r2', '2027-03-01T09:00:00Z', {
      sites: [
        orsItem(
          'item-queried',
          1,
          'Bharat Recycling',
          'update-overseas-site',
          'Queried'
        ),
        orsItem(
          'item-submitted',
          2,
          'Paris Paper',
          'update-overseas-site',
          'Submitted'
        )
      ]
    }),
    submittedRequest('r1', '2027-02-01T09:00:00Z', {
      sites: [
        orsItem(
          'item-granted',
          2,
          'Paris Paper',
          'update-overseas-site',
          'Approved'
        ),
        orsItem(
          'item-withdrawn',
          4,
          'Dragon Plastics',
          'add-overseas-site',
          'Withdrawn'
        ),
        orsItem(
          'item-refused',
          1,
          'Bharat Recycling',
          'remove-overseas-site',
          'Rejected'
        )
      ]
    })
  ]
}

const EXPECTED_ORDER = [
  'item-queried',
  'item-in-progress',
  'item-submitted',
  'item-updated',
  'item-tonnage',
  'item-granted',
  'item-refused',
  'item-withdrawn'
]

const currentApp = makeManageApp()

describe('#manageChangeRequestsController', () => {
  const page = setupManagePageServer()
  const { get } = page

  async function getPage(changes = CURRENT_VIEW, apps = [currentApp]) {
    mockManageGets(apps, undefined, changes)
    const response = await get(PAGE_URL)
    expect(response.statusCode).toBe(statusCodes.ok)
    return response.result
  }

  const rowIds = (html) =>
    [...html.matchAll(/data-testid="change-request-row-([^"]+)"/g)].map(
      (match) => match[1]
    )

  function row(html, itemId) {
    const start = html.indexOf(`data-testid="change-request-row-${itemId}"`)
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('</tr>', start))
  }

  test.each([PAGE_URL, WELSH_PAGE_URL])(
    'GET %s returns 404 when the flag is off, without reading data',
    async (url) => {
      page.setInYearChangesEnabled(false)
      const getSpy = mockManageGets([currentApp])

      const { statusCode } = await get(url)

      expect(statusCode).toBe(statusCodes.notFound)
      expect(getSpy).not.toHaveBeenCalled()
    }
  )

  test('returns 403 without reading data when the operator cannot access the organisation', async () => {
    const getSpy = mockManageGets([currentApp])

    const { statusCode } = await get(
      `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}/change-requests`
    )

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(getSpy).not.toHaveBeenCalled()
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }) {
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toMatch(
        new RegExp(`href="${PAGE_URL}"[^>]*data-testid="try-again-link"`)
      )
    }

    test('when the API fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        apiError(statusCodes.internalServerError)
      )

      expectServiceProblem(await get(PAGE_URL))
    })

    test('when the change requests cannot be read', async () => {
      mockManageGets(
        [currentApp],
        undefined,
        apiError(statusCodes.internalServerError)
      )

      expectServiceProblem(await get(PAGE_URL))
    })

    test('when there is no Approved current-year accreditation', async () => {
      mockManageGets(
        [makeManageApp({ year: CURRENT_YEAR - 1 })],
        undefined,
        CURRENT_VIEW
      )

      expectServiceProblem(await get(PAGE_URL))
    })
  })

  describe('page content', () => {
    test('shows the heading with an "orgName (year, material)" caption', async () => {
      const result = await getPage()

      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*In year change requests\s*</
      )
      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Acme Recycling Ltd \(2027, Plastic\)\s*</
      )
      expect(result).toMatch(/<title>\s*In year change requests/)
    })

    test('has Site name, Type, Status and Action columns', async () => {
      const result = await getPage()

      const head = result.slice(
        result.indexOf('<thead'),
        result.indexOf('</thead>')
      )
      expect(
        [
          ...head.matchAll(/class="govuk-table__header"[^>]*>\s*([^<]+?)\s*</g)
        ].map((m) => m[1])
      ).toEqual(['Site name', 'Type', 'Status', 'Action'])
    })

    test('lists every item, final ones included, most urgent status first', async () => {
      const result = await getPage()

      expect(rowIds(result)).toEqual(EXPECTED_ORDER)
    })

    test('shows an ORS row’s bold site name, address line, type and status', async () => {
      const result = await getPage()

      const queried = row(result, 'item-queried')
      expect(queried).toMatch(
        /<strong[^>]*data-testid="change-request-site-name-item-queried"[^>]*>\s*Bharat Recycling\s*</
      )
      expect(queried).toMatch(
        /data-testid="change-request-site-address-item-queried"[^>]*>\s*1 Industrial Road, India\s*</
      )
      expect(queried).toMatch(
        /data-testid="change-request-type-item-queried"[^>]*>\s*ORS update\s*</
      )
      expect(queried).toMatch(
        /class="govuk-tag govuk-tag--orange"[^>]*data-testid="change-request-status-item-queried"[^>]*>\s*QUERIED\s*</
      )
    })

    test.each([
      [
        'item-in-progress',
        'New ORS accreditation',
        'govuk-tag--blue',
        'IN PROGRESS'
      ],
      ['item-submitted', 'ORS update', 'govuk-tag--green', 'SUBMITTED'],
      ['item-updated', 'ORS update', 'govuk-tag--turquoise', 'UPDATED'],
      [
        'item-tonnage',
        'Tonnage band upgrade',
        'govuk-tag--turquoise',
        'DULY MADE'
      ],
      ['item-granted', 'ORS update', 'govuk-tag--green', 'GRANTED'],
      ['item-refused', 'Change request', 'govuk-tag--red', 'REFUSED'],
      [
        'item-withdrawn',
        'New ORS accreditation',
        'govuk-tag--grey',
        'WITHDRAWN'
      ]
    ])(
      'labels %s as "%s" with a %s %s tag',
      async (itemId, type, tagClass, status) => {
        const result = await getPage()

        const itemRow = row(result, itemId)
        expect(itemRow).toMatch(
          new RegExp(
            `data-testid="change-request-type-${itemId}"[^>]*>\\s*${type}\\s*<`
          )
        )
        expect(itemRow).toMatch(
          new RegExp(
            `class="govuk-tag ${tagClass}"[^>]*data-testid="change-request-status-${itemId}"[^>]*>\\s*${status}\\s*<`
          )
        )
      }
    )

    test('shows "Not applicable" for a tonnage band upgrade’s site', async () => {
      const result = await getPage()

      const tonnage = row(result, 'item-tonnage')
      expect(tonnage).toMatch(
        /data-testid="change-request-site-name-item-tonnage"[^>]*>\s*Not applicable\s*</
      )
      expect(tonnage).not.toContain('change-request-site-address-item-tonnage')
    })

    test('links each row’s View to the item’s detail page', async () => {
      const result = await getPage()

      for (const itemId of EXPECTED_ORDER) {
        expect(row(result, itemId)).toMatch(
          new RegExp(
            `href="${PAGE_URL}/${itemId}"[^>]*data-testid="change-request-view-${itemId}"[^>]*>\\s*View<span class="govuk-visually-hidden">`
          )
        )
      }
    })

    test('names the row in each View link for screen readers', async () => {
      const result = await getPage()

      expect(row(result, 'item-queried')).toContain(
        '<span class="govuk-visually-hidden"> ORS update for Bharat Recycling</span>'
      )
      expect(row(result, 'item-tonnage')).toContain(
        '<span class="govuk-visually-hidden"> Tonnage band upgrade</span>'
      )
    })

    test('links back to the manage page and home to the Re/Ex material page', async () => {
      const result = await getPage()

      expect(result).toMatch(
        new RegExp(`href="${MANAGE_URL}"[^>]*data-testid="back-link"`)
      )
      expect(result).toMatch(
        new RegExp(
          `href="${MANAGE_REEX_URL}"[^>]*data-testid="return-to-home-link"[^>]*>\\s*Return to home\\s*<`
        )
      )
    })

    test('keeps the Welsh prefix on its links', async () => {
      mockManageGets([currentApp], undefined, CURRENT_VIEW)

      const { statusCode, result } = await get(WELSH_PAGE_URL)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(`href="/cy${MANAGE_URL}"[^>]*data-testid="back-link"`)
      )
      expect(result).toMatch(
        new RegExp(
          `href="/cy${PAGE_URL}/item-queried"[^>]*data-testid="change-request-view-item-queried"`
        )
      )
      expect(result).toContain('[Welsh] In year change requests')
    })
  })

  describe('with no change requests', () => {
    test('shows the no-results message and a Clear filters link instead of a table', async () => {
      const result = await getPage(noChangeRequests)

      expect(result).not.toContain('data-testid="change-requests-table"')
      expect(result).toMatch(
        /data-testid="no-results-title"[^>]*>\s*There are no matching results\s*</
      )
      expect(result).toMatch(
        /data-testid="no-results-body"[^>]*>\s*Improve your search results by removing one or more of your selected filters.\s*</
      )
      expect(result).toMatch(
        new RegExp(
          `href="${PAGE_URL}"[^>]*data-testid="clear-filters-link"[^>]*>\\s*Clear filters\\s*<`
        )
      )
    })

    test('shows no count line or pagination', async () => {
      const result = await getPage(noChangeRequests)

      expect(result).not.toContain('data-testid="change-requests-count"')
      expect(result).not.toContain('govuk-pagination')
    })
  })

  describe('count line and pagination', () => {
    const MANY_VIEW = {
      ...noChangeRequests,
      sites: CURRENT_VIEW.sites,
      requests: Array.from({ length: 23 }, (_, index) => {
        const number = String(index + 1).padStart(2, '0')
        // Newest first, so the list order follows the item number.
        const submittedAt = new Date(
          Date.UTC(2027, 3, 30 - index, 9)
        ).toISOString()
        return submittedRequest(`many-${number}`, submittedAt, {
          sites: [
            orsItem(
              `item-${number}`,
              1,
              'Bharat Recycling',
              'update-overseas-site',
              'Submitted'
            )
          ]
        })
      })
    }
    const itemIds = (from, to) =>
      Array.from(
        { length: to - from + 1 },
        (_, index) => `item-${String(from + index).padStart(2, '0')}`
      )

    async function getListPage(query, changes = MANY_VIEW, url = PAGE_URL) {
      mockManageGets([currentApp], undefined, changes)
      const response = await get(`${url}${query}`)
      expect(response.statusCode).toBe(statusCodes.ok)
      return response.result
    }

    const countLine = (html) =>
      html.match(
        /<p[^>]*data-testid="change-requests-count"[^>]*>\s*<strong[^>]*>\s*([^<]+?)\s*<\/strong>/
      )?.[1]

    const paginationLinks = (html) =>
      [
        ...html.matchAll(
          /class="govuk-link govuk-pagination__link" href="([^"]+)"(?: rel="(prev|next)")?/g
        )
      ].map(([, href, rel]) => [rel ?? 'page', href.replaceAll('&amp;', '&')])

    test('shows all the items, a bold count and no pagination for 10 or fewer', async () => {
      const result = await getPage()

      expect(rowIds(result)).toEqual(EXPECTED_ORDER)
      expect(countLine(result)).toBe('Showing 1-8 of 8')
      expect(result).not.toContain('govuk-pagination')
    })

    test('shows the first 10 items with pagination when there are more', async () => {
      const result = await getListPage('')

      expect(rowIds(result)).toEqual(itemIds(1, 10))
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

    test('shows the page from the query string', async () => {
      const result = await getListPage('?page=2')

      expect(rowIds(result)).toEqual(itemIds(11, 20))
      expect(countLine(result)).toBe('Showing 11-20 of 23')
      expect(paginationLinks(result)).toEqual([
        ['prev', `${PAGE_URL}?page=1`],
        ['page', `${PAGE_URL}?page=1`],
        ['page', `${PAGE_URL}?page=2`],
        ['page', `${PAGE_URL}?page=3`],
        ['next', `${PAGE_URL}?page=3`]
      ])
    })

    test('keeps the visually hidden " page" on the Previous and Next links', async () => {
      const result = await getListPage('?page=2')

      expect(result).toMatch(
        /rel="prev"[\s\S]*?Previous<span class="govuk-visually-hidden"> page<\/span>/
      )
      expect(result).toMatch(
        /rel="next"[\s\S]*?Next<span class="govuk-visually-hidden"> page<\/span>/
      )
    })

    test('shows the remaining items on the last page', async () => {
      const result = await getListPage('?page=3')

      expect(rowIds(result)).toEqual(itemIds(21, 23))
      expect(countLine(result)).toBe('Showing 21-23 of 23')
      expect(paginationLinks(result).at(-1)).toEqual([
        'page',
        `${PAGE_URL}?page=3`
      ])
    })

    test.each([
      ['a page past the last', '?page=99', 21, 23],
      ['page 0', '?page=0', 1, 10],
      ['a page that is not a number', '?page=last', 1, 10]
    ])('clamps %s to a valid page', async (_, query, from, to) => {
      const result = await getListPage(query)

      expect(rowIds(result)).toEqual(itemIds(from, to))
      expect(countLine(result)).toBe(`Showing ${from}-${to} of 23`)
    })

    test('pages the filtered items and keeps the filters in the links', async () => {
      const filteredView = {
        ...MANY_VIEW,
        requests: [
          ...MANY_VIEW.requests,
          submittedRequest('tonnage', '2027-05-01T09:00:00Z', {
            tonnage: tonnageItem('item-tonnage', 'Submitted')
          })
        ]
      }
      const result = await getListPage(
        '?status=Submitted&type=update-overseas-site&page=2',
        filteredView
      )
      const filtered = `${PAGE_URL}?status=Submitted&type=update-overseas-site`

      expect(rowIds(result)).toEqual(itemIds(11, 20))
      expect(countLine(result)).toBe('Showing 11-20 of 23')
      expect(paginationLinks(result)).toEqual([
        ['prev', `${filtered}&page=1`],
        ['page', `${filtered}&page=1`],
        ['page', `${filtered}&page=2`],
        ['page', `${filtered}&page=3`],
        ['next', `${filtered}&page=3`]
      ])
    })

    test('shows no pagination when the filtered items fit on one page', async () => {
      const result = await getListPage('?type=upgrade-tonnage-band', {
        ...MANY_VIEW,
        requests: [
          ...MANY_VIEW.requests,
          submittedRequest('tonnage', '2027-05-01T09:00:00Z', {
            tonnage: tonnageItem('item-tonnage', 'Submitted')
          })
        ]
      })

      expect(rowIds(result)).toEqual(['item-tonnage'])
      expect(countLine(result)).toBe('Showing 1-1 of 1')
      expect(result).not.toContain('govuk-pagination')
    })

    test('keeps the Welsh prefix and labels in the pagination', async () => {
      const result = await getListPage('?page=2', MANY_VIEW, WELSH_PAGE_URL)

      expect(countLine(result)).toBe('[Welsh] Showing 11-20 of 23')
      expect(paginationLinks(result)[0]).toEqual([
        'prev',
        `${WELSH_PAGE_URL}?page=1`
      ])
      expect(result).toContain('aria-label="[Welsh] Pagination"')
      expect(result).toContain('aria-label="[Welsh] Page 3"')
      expect(result).toMatch(
        /rel="prev"[\s\S]*?\[Welsh\] Previous<span class="govuk-visually-hidden"> \[Welsh\] page<\/span>/
      )
      expect(result).toMatch(
        /rel="next"[\s\S]*?\[Welsh\] Next<span class="govuk-visually-hidden"> \[Welsh\] page<\/span>/
      )
    })
  })

  describe('filters', () => {
    async function getFiltered(query, changes = CURRENT_VIEW, url = PAGE_URL) {
      mockManageGets([currentApp], undefined, changes)
      const response = await get(`${url}${query}`)
      expect(response.statusCode).toBe(statusCodes.ok)
      return response.result
    }

    const filterForm = (html) => {
      const start = html.indexOf('data-testid="change-requests-filters"')
      expect(start).toBeGreaterThan(-1)
      return html.slice(
        html.lastIndexOf('<form', start),
        html.indexOf('</form>', start)
      )
    }

    const options = (html, name) => {
      const start = html.indexOf(`name="${name}"`)
      expect(start).toBeGreaterThan(-1)
      const select = html.slice(start, html.indexOf('</select>', start))
      return [
        ...select.matchAll(
          /<option value="([^"]*)"( selected)?[^>]*>\s*([^<]+?)\s*</g
        )
      ].map(([, value, selected, text]) => ({
        value,
        text,
        selected: Boolean(selected)
      }))
    }
    const selectedValue = (html, name) =>
      options(html, name).find((option) => option.selected)?.value

    const countLine = (html) =>
      html.match(
        /data-testid="change-requests-count"[^>]*>\s*<strong[^>]*>\s*([^<]+?)\s*</
      )?.[1]

    test('shows a GET form that submits itself when a select changes, with no Apply button', async () => {
      const form = filterForm(await getFiltered(''))

      expect(form).toMatch(/<form[^>]*method="get"/)
      expect(form).toMatch(new RegExp(`<form[^>]*action="${PAGE_URL}"`))
      expect(form).toMatch(/<form[^>]*data-module="app-auto-submit"/)
      expect(form).toMatch(/<legend[^>]*>\s*Filter by\s*</)
      expect(form).toMatch(/<label[^>]*for="status"[^>]*>\s*Status\s*</)
      expect(form).toMatch(/<label[^>]*for="type"[^>]*>\s*Type\s*</)
      expect(form).not.toMatch(/<button|type="submit"/)
      // A filter change always lands on page 1.
      expect(form).not.toContain('name="page"')
    })

    test('offers a placeholder and all 8 statuses in sort order', async () => {
      const result = await getFiltered('')

      expect(options(result, 'status').map((option) => option.text)).toEqual([
        'Select status',
        'Queried',
        'In progress',
        'Submitted',
        'Updated',
        'Duly made',
        'Granted',
        'Refused',
        'Withdrawn'
      ])
      expect(selectedValue(result, 'status')).toBe('')
    })

    test('offers a placeholder and all 3 types', async () => {
      const result = await getFiltered('')

      expect(options(result, 'type')).toEqual([
        { value: '', text: 'Select type', selected: true },
        {
          value: 'add-overseas-site',
          text: 'New ORS accreditation',
          selected: false
        },
        { value: 'update-overseas-site', text: 'ORS update', selected: false },
        {
          value: 'upgrade-tonnage-band',
          text: 'Tonnage band upgrade',
          selected: false
        }
      ])
    })

    test('has a Clear filters link to the unfiltered list', async () => {
      const result = await getFiltered('?status=Queried')

      expect(filterForm(result)).toMatch(
        new RegExp(
          `href="${PAGE_URL}"[^>]*data-testid="clear-filters-link"[^>]*>\\s*Clear filters\\s*<`
        )
      )
    })

    test('brings back the full list from Clear filters', async () => {
      const filtered = await getFiltered(
        '?status=Queried&type=add-overseas-site'
      )
      const clearHref = filtered.match(
        /href="([^"]+)"[^>]*data-testid="clear-filters-link"/
      )[1]

      const result = await getFiltered('', CURRENT_VIEW, clearHref)

      expect(rowIds(result)).toEqual(EXPECTED_ORDER)
      expect(selectedValue(result, 'status')).toBe('')
      expect(selectedValue(result, 'type')).toBe('')
    })

    test('filters by status', async () => {
      const result = await getFiltered('?status=Queried')

      expect(rowIds(result)).toEqual(['item-queried'])
      expect(selectedValue(result, 'status')).toBe('Queried')
      expect(countLine(result)).toBe('Showing 1-1 of 1')
    })

    test('filters by type', async () => {
      const result = await getFiltered('?type=update-overseas-site')

      expect(rowIds(result)).toEqual([
        'item-queried',
        'item-submitted',
        'item-updated',
        'item-granted'
      ])
      expect(selectedValue(result, 'type')).toBe('update-overseas-site')
      expect(countLine(result)).toBe('Showing 1-4 of 4')
    })

    test('filters by status and type together', async () => {
      const result = await getFiltered(
        '?status=Submitted&type=update-overseas-site'
      )

      expect(rowIds(result)).toEqual(['item-submitted'])
      expect(selectedValue(result, 'status')).toBe('Submitted')
      expect(selectedValue(result, 'type')).toBe('update-overseas-site')
    })

    test('treats a placeholder as no filter for that select only', async () => {
      const result = await getFiltered('?status=&type=add-overseas-site')

      expect(rowIds(result)).toEqual(['item-in-progress', 'item-withdrawn'])
      expect(selectedValue(result, 'status')).toBe('')
    })

    test('ignores unknown filter values', async () => {
      const result = await getFiltered(
        '?status=Expired&type=remove-overseas-site'
      )

      expect(rowIds(result)).toEqual(EXPECTED_ORDER)
      expect(selectedValue(result, 'status')).toBe('')
      expect(selectedValue(result, 'type')).toBe('')
    })

    test('shows the no-results message with the filters still set when nothing matches', async () => {
      const result = await getFiltered(
        '?status=Withdrawn&type=update-overseas-site'
      )

      expect(result).not.toContain('data-testid="change-requests-table"')
      expect(result).toMatch(
        /data-testid="no-results-title"[^>]*>\s*There are no matching results\s*</
      )
      expect(selectedValue(result, 'status')).toBe('Withdrawn')
      expect(selectedValue(result, 'type')).toBe('update-overseas-site')
      expect(result).toContain('data-testid="clear-filters-link"')
      expect(result).not.toContain('data-testid="change-requests-count"')
      expect(result).not.toContain('govuk-pagination')
    })

    test('shows the filters when there are no change requests at all', async () => {
      const result = await getFiltered('', noChangeRequests)

      expect(result).toContain('data-testid="no-results-title"')
      expect(filterForm(result)).toContain('name="status"')
    })

    test('keeps the Welsh prefix and labels in the filters', async () => {
      const form = filterForm(
        await getFiltered('?status=Queried', CURRENT_VIEW, WELSH_PAGE_URL)
      )

      expect(form).toMatch(new RegExp(`<form[^>]*action="${WELSH_PAGE_URL}"`))
      expect(form).toContain('[Welsh] Filter by')
      expect(form).toContain('[Welsh] Select status')
      expect(form).toMatch(
        new RegExp(
          `href="${WELSH_PAGE_URL}"[^>]*data-testid="clear-filters-link"`
        )
      )
    })
  })

  describe('year scoping', () => {
    const previousApp = makeManageApp({
      id: 'app-previous',
      year: CURRENT_YEAR - 1,
      createdAt: '2025-10-01T09:00:00Z'
    })
    const PREVIOUS_VIEW = {
      ...noChangeRequests,
      requests: [
        submittedRequest('old', '2026-06-01T09:00:00Z', {
          tonnage: tonnageItem('item-last-year', 'Queried')
        })
      ]
    }

    test('lists only the current-year accreditation’s change requests', async () => {
      const changesFor = vi.fn((applicationId) =>
        applicationId === 'app-previous' ? PREVIOUS_VIEW : CURRENT_VIEW
      )

      const result = await getPage(changesFor, [previousApp, currentApp])

      expect(rowIds(result)).toEqual(EXPECTED_ORDER)
      expect(result).not.toContain('item-last-year')
      expect(changesFor.mock.calls).toEqual([['app-current']])
    })
  })

  test('lists a reprocessor’s tonnage band upgrades', async () => {
    const reprocessor = makeManageApp({ wasteProcessingType: 'reprocessor' })

    const result = await getPage(
      {
        ...noChangeRequests,
        requests: [
          submittedRequest('t1', '2027-03-01T09:00:00Z', {
            tonnage: tonnageItem('item-reprocessor', 'Submitted')
          })
        ]
      },
      [reprocessor]
    )

    expect(rowIds(result)).toEqual(['item-reprocessor'])
  })

  describe('with the frontend stub API', () => {
    beforeEach(() => {
      vi.useRealTimers()
      vi.spyOn(apiClient, 'get').mockImplementation((url) =>
        url.startsWith('/api/v1/accreditation-changes/')
          ? persistentGet(url)
          : stubApiClient.get(url)
      )
      operatorCanAccessOrganisation.mockResolvedValue(true)
    })

    const listUrl = (orgId, registrationId, material) =>
      `/manage/${orgId}/${registrationId}/${material}/change-requests`

    const cellTexts = (html, cell) =>
      [
        ...html.matchAll(
          new RegExp(
            `data-testid="change-request-${cell}-[^"]+"[^>]*>\\s*([^<]+?)\\s*<`,
            'g'
          )
        )
      ].map((match) => match[1])
    const statuses = (html) => cellTexts(html, 'status')

    test('lists the seeded exporter’s items over two pages, most urgent first', async () => {
      const exporterUrl = listUrl(
        MANAGE_EXPORTER_ORG_ID,
        MANAGE_EXPORTER_REGISTRATION_ID,
        'Plastic'
      )
      const first = await get(exporterUrl)
      const second = await get(`${exporterUrl}?page=2`)

      expect(first.statusCode).toBe(statusCodes.ok)
      expect(second.statusCode).toBe(statusCodes.ok)
      expect([...statuses(first.result), ...statuses(second.result)]).toEqual([
        'QUERIED',
        'IN PROGRESS',
        'SUBMITTED',
        'UPDATED',
        'DULY MADE',
        'GRANTED',
        'GRANTED',
        'GRANTED',
        'REFUSED',
        'REFUSED',
        'REFUSED',
        'WITHDRAWN',
        'WITHDRAWN'
      ])
      expect(statuses(second.result)).toHaveLength(3)
      expect(second.result).toContain('Showing 11-13 of 13')
    })

    test('lists the seeded reprocessor’s tonnage band upgrades', async () => {
      const { statusCode, result } = await get(
        listUrl(
          MANAGE_EXPORTER_ORG_ID,
          MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
          MANAGE_EXPORTER_ORG_REPROCESSOR_MATERIAL
        )
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(statuses(result)).toEqual(['SUBMITTED', 'GRANTED', 'REFUSED'])
      expect(cellTexts(result, 'type')).toEqual([
        'Tonnage band upgrade',
        'Tonnage band upgrade',
        'Tonnage band upgrade'
      ])
    })

    test('shows the no-results message for the org with no change requests', async () => {
      const { statusCode, result } = await get(
        listUrl(
          NO_CHANGE_REQUESTS_ORG_ID,
          NO_CHANGE_REQUESTS_REGISTRATION_ID,
          'Plastic'
        )
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="no-results-title"')
    })
  })
})
