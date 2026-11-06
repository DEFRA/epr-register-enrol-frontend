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

    test('lists the seeded exporter’s items, most urgent first', async () => {
      const { statusCode, result } = await get(
        listUrl(
          MANAGE_EXPORTER_ORG_ID,
          MANAGE_EXPORTER_REGISTRATION_ID,
          'Plastic'
        )
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(statuses(result)).toEqual([
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
