import { describe, test, expect, beforeEach, vi } from 'vitest'
import Boom from '@hapi/boom'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import { persistentStubApiClient } from '../../common/persistentStubApiClient.js'
import {
  MANAGE_ORG_ID as ORG_ID,
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_URL as PAGE_URL,
  MANAGE_REEX_URL,
  apiError,
  approvedRegistration,
  makeManageApp as makeApp,
  mockManageGets,
  noChangeRequests,
  registrationOnlyExporter,
  registrationOnlyReprocessor
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'
import { currentYear, yearSuffix } from '../../common/helpers/currentYear.js'
import {
  MANAGE_EXPORTER_ORG_ID,
  MANAGE_EXPORTER_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID,
  MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID,
  NO_CHANGE_REQUESTS_ORG_ID,
  NO_CHANGE_REQUESTS_REGISTRATION_ID,
  REGISTRATION_ONLY_ORG_ID,
  REGISTRATION_ONLY_REGISTRATION_ID
} from '../../common/constants/test-orgs.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

// Read before any test spies on apiClient, which in tests is this same client.
const persistentGet = persistentStubApiClient.get
const WELSH_PAGE_URL = `/cy${PAGE_URL}`

const REGISTRATION_STATUS_URL = `/api/v1/registrations/${REGISTRATION_ID}/status?organisationId=${ORG_ID}`

const LIST_URL = `/api/v1/accreditation-applications/${ORG_ID}`

const STUB_EXPORTER_URL = `/manage/${MANAGE_EXPORTER_ORG_ID}/${MANAGE_EXPORTER_REGISTRATION_ID}/Plastic`

const reprocessorApp = () => makeApp({ wasteProcessingType: 'reprocessor' })

function fetchedApplicationIds(getSpy) {
  return getSpy.mock.calls
    .map(([url]) => url)
    .filter((url) => url.startsWith(`${LIST_URL}/`))
    .map((url) => url.slice(LIST_URL.length + 1))
}

describe('#manageRegistrationAccreditationController', () => {
  const page = setupManagePageServer()
  const { get } = page

  test.each([PAGE_URL, WELSH_PAGE_URL])(
    'GET %s returns 404 when the flag is off, without reading data',
    async (url) => {
      page.setInYearChangesEnabled(false)
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await get(url)

      expect(statusCode).toBe(statusCodes.notFound)
      expect(getSpy).not.toHaveBeenCalled()
      expect(operatorCanAccessOrganisation).not.toHaveBeenCalled()
    }
  )

  test('no longer serves the old /registration-accreditation path', async () => {
    mockManageGets([makeApp()])

    const { statusCode } = await get(`${PAGE_URL}/registration-accreditation`)

    expect(statusCode).toBe(statusCodes.notFound)
  })

  describe('organisation access', () => {
    test('returns 403 without reading data when the operator cannot access the organisation', async () => {
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await get(
        `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}`
      )

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(getSpy).not.toHaveBeenCalled()
    })

    test('returns the service-unavailable page when the access check is unavailable', async () => {
      operatorCanAccessOrganisation.mockRejectedValueOnce(
        Boom.serverUnavailable()
      )
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await get(PAGE_URL)

      expect(statusCode).toBe(statusCodes.serviceUnavailable)
      expect(getSpy).not.toHaveBeenCalled()
    })
  })

  describe('choosing the current accreditation', () => {
    test('chooses the Approved current-year application over other years, statuses, registrations and materials', async () => {
      const getSpy = mockManageGets([
        makeApp({ id: 'app-last-year', year: CURRENT_YEAR - 1 }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 }),
        makeApp({ id: 'app-started', applicationStatus: 'Started' }),
        makeApp({ id: 'app-withdrawn', applicationStatus: 'Withdrawn' }),
        makeApp({ id: 'app-other-registration', registrationId: 'REG999' }),
        makeApp({ id: 'app-other-material', material: 'glass' }),
        makeApp({
          id: 'app-current',
          createdAt: '2020-01-01T00:00:00Z'
        })
      ])

      const { statusCode } = await get(PAGE_URL)

      expect(statusCode).toBe(statusCodes.ok)
      expect(fetchedApplicationIds(getSpy)).toEqual(['app-current'])
    })

    test('chooses the most recent when several Approved current-year applications match', async () => {
      const getSpy = mockManageGets([
        makeApp({ id: 'app-older', createdAt: '2026-09-01T00:00:00Z' }),
        makeApp({ id: 'app-newest', createdAt: '2026-11-01T00:00:00Z' }),
        makeApp({ id: 'app-middle', createdAt: '2026-10-01T00:00:00Z' })
      ])

      await get(PAGE_URL)

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-newest'])
    })

    test('takes the year from the clock on the last moment of the year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR}-12-31T23:59:59.999Z`))
      const getSpy = mockManageGets([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await get(PAGE_URL)

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-this-year'])
    })

    test('takes the year from the clock on the first moment of the next year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
      const getSpy = mockManageGets([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await get(PAGE_URL)

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-next-year'])
    })
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }, url = PAGE_URL) {
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="service-problem-heading"')
      expect(result).toMatch(
        new RegExp(`href="${url}"[^>]*data-testid="try-again-link"`)
      )
    }

    // RA-697: an outage never passes for "you have no accreditation".
    test('when listing applications fails, even for a registration-only operator', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
        if (url.startsWith('/api/v1/registrations/')) {
          return registrationOnlyExporter
        }
        throw apiError(statusCodes.internalServerError)
      })

      expectServiceProblem(await get(PAGE_URL))
    })

    // The backend names the organisation only once ReEx says it holds the
    // registration, which nothing else ties to the URL's organisation.
    test('when there is no accreditation and ReEx did not name the organisation', async () => {
      mockManageGets([], {
        ...registrationOnlyExporter,
        organisationName: null
      })

      expectServiceProblem(await get(PAGE_URL))
    })

    test.each(['Created', 'Rejected', 'Cancelled'])(
      'when there is no accreditation and the registration is %s',
      async (status) => {
        mockManageGets([], { ...registrationOnlyExporter, status })

        expectServiceProblem(await get(PAGE_URL))
      }
    )

    test('when listing applications fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        apiError(statusCodes.internalServerError)
      )

      expectServiceProblem(await get(PAGE_URL))
    })

    test('when fetching the chosen application fails', async () => {
      const apps = [makeApp()]
      vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
        if (url.endsWith('/app-current')) {
          throw apiError(502)
        }
        return apps
      })

      expectServiceProblem(await get(PAGE_URL))
    })

    test('keeps the Welsh path in the try-again link', async () => {
      mockManageGets([])

      expectServiceProblem(await get(WELSH_PAGE_URL), WELSH_PAGE_URL)
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

    test('when the registration-status call fails', async () => {
      mockManageGets([makeApp()], apiError(statusCodes.internalServerError))

      expectServiceProblem(await get(PAGE_URL))
    })
  })

  test('asks for the status of the registration in the URL, naming its organisation', async () => {
    const getSpy = mockManageGets([makeApp()])

    await get(PAGE_URL)

    expect(getSpy).toHaveBeenCalledWith(REGISTRATION_STATUS_URL)
  })

  // RA-697: an Approved registration with no Approved current-year
  // accreditation, whether never applied for, not yet granted or granted only
  // in an earlier year.
  describe('registration only', () => {
    test.each([
      ['no application at all', []],
      [
        'an application not yet granted and one from last year',
        [
          makeApp({ id: 'app-started', applicationStatus: 'Started' }),
          makeApp({ id: 'app-last-year', year: CURRENT_YEAR - 1 })
        ]
      ]
    ])('loads the dashboard with %s', async (_label, apps) => {
      mockManageGets(apps, registrationOnlyExporter)

      const { statusCode, result } = await get(PAGE_URL)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*Manage your registration and accreditation\s*</
      )
    })

    describe('for an exporter', () => {
      let result
      let getSpy

      beforeEach(async () => {
        getSpy = mockManageGets([], registrationOnlyExporter)
        const response = await get(PAGE_URL)
        expect(response.statusCode).toBe(statusCodes.ok)
        result = response.result
      })

      test('captions the page with the organisation, the current year and the material', () => {
        expect(result).toMatch(
          /data-testid="page-caption"[^>]*>\s*Reg Only Exports Ltd \(2027, Plastic\)\s*</
        )
      })

      test("shows the registration's status as a green GRANTED tag", () => {
        expect(result).toMatch(
          /<p[^>]*>\s*Status:\s*<\/p>\s*<div class="govuk-body" data-testid="registration-status">/
        )
        expect(result).toMatch(
          /class="govuk-tag govuk-tag--green"[^>]*data-testid="registration-status-tag"[^>]*>\s*GRANTED\s*</
        )
        expect(result).not.toContain('data-testid="application-status"')
      })

      test('shows the registration number', () => {
        expect(result).toMatch(
          /data-testid="registration-number"[^>]*>\s*R27EX0500180001PL\s*</
        )
      })

      test('shows no accreditation number or expiry date', () => {
        expect(result).not.toContain('data-testid="accreditation-number"')
        expect(result).not.toContain('data-testid="expiry-date"')
      })

      test('hides the Manage accreditation card and runs the overseas-sites card the full width', () => {
        expect(result).not.toContain(
          'data-testid="task-card-manage-accreditation"'
        )
        expect(result).toMatch(
          /<div class="govuk-grid-column-full app-task-card__column">\s*<div class="app-task-card" data-testid="task-card-manage-overseas-sites">/
        )
        expect(result).toMatch(
          new RegExp(
            `href="${PAGE_URL}/overseas-sites"[^>]*data-testid="manage-overseas-sites-link"`
          )
        )
      })

      test('shows no site address', () => {
        expect(result).not.toContain('data-testid="site-address"')
      })

      // Task 011 adds the registration's change requests.
      test('leaves out the change requests section without reading them', () => {
        expect(result).not.toContain('data-testid="change-requests-section"')
        expect(
          getSpy.mock.calls.filter(([url]) =>
            url.startsWith('/api/v1/accreditation-changes/')
          )
        ).toEqual([])
      })
    })

    // The URL's material must be the registration's, as it must be the
    // accreditation's for an accredited operator.
    test('shows the service-problem page for another material', async () => {
      mockManageGets([], registrationOnlyReprocessor)

      const { statusCode, result } = await get(PAGE_URL)

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="service-problem-heading"')
    })

    test('shows a reprocessor their site address, a glass caption and no cards', async () => {
      mockManageGets([], registrationOnlyReprocessor)

      const { statusCode, result } = await get(
        `/manage/${ORG_ID}/${REGISTRATION_ID}/glass`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Reg Only Exports Ltd \(2027, Glass - Remelt\)\s*</
      )
      expect(result).toMatch(
        /data-testid="site-address"[^>]*>\s*Unit 9, Furnace Lane, Doncaster, DN4 5HT\s*</
      )
      expect(result).not.toContain('app-task-card')
    })

    test('takes the caption year from the clock', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
      mockManageGets([], registrationOnlyExporter)

      const { result } = await get(PAGE_URL)

      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Reg Only Exports Ltd \(2028, Plastic\)\s*</
      )
    })
  })

  test('accepts the lowercase material slug Re/Ex links with', async () => {
    mockManageGets([makeApp()])

    const { statusCode } = await get(
      `/manage/${ORG_ID}/${REGISTRATION_ID}/plastic`
    )

    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('content shared by exporters and reprocessors', () => {
    let result

    beforeEach(async () => {
      mockManageGets([makeApp()])
      const response = await get(PAGE_URL)
      expect(response.statusCode).toBe(statusCodes.ok)
      result = response.result
    })

    test('shows the heading with an "orgName (year, material)" caption', () => {
      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*Manage your registration and accreditation\s*</
      )
      expect(result).toMatch(
        /data-testid="page-caption"[^>]*>\s*Acme Recycling Ltd \(2027, Plastic\)\s*</
      )
    })

    test('shows the application status with the re-accreditation status tag', () => {
      expect(result).toMatch(
        /class="govuk-tag govuk-tag--green"[^>]*data-testid="application-status-tag"[^>]*>\s*GRANTED\s*</
      )
    })

    test('shows the accreditation and registration numbers', () => {
      expect(result).toMatch(
        /data-testid="accreditation-number"[^>]*>\s*A27EX0500180001PL\s*</
      )
      expect(result).toMatch(
        /data-testid="registration-number"[^>]*>\s*R27EX0500180001PL\s*</
      )
    })

    test('shows 31 December of the accreditation year as the expiry date', () => {
      expect(result).toMatch(
        /data-testid="expiry-date"[^>]*>\s*31 Dec 2027\s*</
      )
    })

    test('renders Upgrade tonnage as a link that does not navigate', () => {
      const anchor = result.match(
        /<a[^>]*data-testid="upgrade-tonnage-link"[^>]*>/
      )?.[0]
      expect(anchor).toBeDefined()
      expect(anchor).toContain('govuk-link')
      expect(anchor).not.toContain('href=')
    })

    test('links back to the Re/Ex material page', () => {
      expect(result).toMatch(
        new RegExp(`href="${MANAGE_REEX_URL}"[^>]*data-testid="back-link"`)
      )
    })
  })

  test('takes the expiry year from the accreditation, not the clock', async () => {
    vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
    mockManageGets([
      makeApp({ year: CURRENT_YEAR + 1, yearlyMetrics: { year: '2028' } })
    ])

    const { result } = await get(PAGE_URL)

    expect(result).toMatch(/data-testid="expiry-date"[^>]*>\s*31 Dec 2028\s*</)
  })

  test('shows an exporter no site address, and both cards', async () => {
    mockManageGets([makeApp()])

    const { result } = await get(PAGE_URL)

    expect(result).not.toContain('data-testid="site-address"')
    expect(result).toContain('data-testid="task-card-manage-accreditation"')
    expect(result).toMatch(
      new RegExp(
        `href="${PAGE_URL}/overseas-sites"[^>]*data-testid="manage-overseas-sites-link"`
      )
    )
  })

  test('gives the change requests section and the card titles h2 headings, as siblings under the h1', async () => {
    mockManageGets([makeApp()])

    const { result } = await get(PAGE_URL)

    expect(result).toMatch(
      /<h2 class="govuk-heading-m"[^>]*>\s*In year change requests\s*<\/h2>/
    )
    expect(result).toMatch(
      /<h2 class="govuk-heading-m">\s*Manage accreditation\s*<\/h2>/
    )
    expect(result).toMatch(
      /<h2 class="govuk-heading-m">\s*Manage overseas reprocessing sites\s*<\/h2>/
    )
  })

  test('shows a reprocessor their site address, and only the Manage accreditation card', async () => {
    mockManageGets([reprocessorApp()])

    const { result } = await get(PAGE_URL)

    expect(result).toMatch(
      /data-testid="site-address"[^>]*>\s*Unit 5, Bolton, BL4 7AQ\s*</
    )
    expect(result).toContain('data-testid="task-card-manage-accreditation"')
    expect(result).not.toContain(
      'data-testid="task-card-manage-overseas-sites"'
    )
    expect(result).not.toContain('manage-overseas-sites-link')
  })

  test('renders under the Welsh path with Welsh-prefixed links', async () => {
    mockManageGets([makeApp()])

    const { statusCode, result } = await get(WELSH_PAGE_URL)

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(
      '[Welsh] Manage your registration and accreditation'
    )
    expect(result).toMatch(/data-testid="expiry-date"[^>]*>\s*31 Rhag 2027\s*</)
    expect(result).toMatch(
      new RegExp(`href="${MANAGE_REEX_URL}"[^>]*data-testid="back-link"`)
    )
    expect(result).toMatch(
      new RegExp(
        `href="${WELSH_PAGE_URL}/overseas-sites"[^>]*data-testid="manage-overseas-sites-link"`
      )
    )
  })

  describe('In year change requests section', () => {
    const item = (itemId, changeType, status) => ({
      siteId: 1,
      orsId: '001',
      siteName: 'Bharat Recycling',
      itemId,
      changeType,
      status,
      validFrom: null,
      withdrawnAt: null
    })

    const request = (requestId, { sites = [], tonnage = null }) => ({
      requestId,
      changeType: 'add-overseas-site',
      status: 'Submitted',
      createdAt: '2027-03-01T09:00:00Z',
      updatedAt: '2027-03-01T09:00:00Z',
      submittedAt: '2027-03-01T09:00:00Z',
      submittedBy: null,
      caseManagementReference: `CR-${requestId}`,
      sites,
      tonnageBandUpgrade: tonnage
    })

    const tonnageItem = (itemId, status) => ({
      itemId,
      changeType: 'upgrade-tonnage-band',
      status,
      validFrom: null,
      withdrawnAt: null,
      requestedBand: 'UpTo10000'
    })

    const viewWith = (requests) => ({ ...noChangeRequests, requests })

    const ACTIVE_VIEW = viewWith([
      request('r3', {
        sites: [
          item('a1', 'add-overseas-site', 'Submitted'),
          item('u1', 'update-overseas-site', 'DulyMade')
        ],
        tonnage: tonnageItem('t1', 'Approved')
      }),
      request('r2', {
        sites: [
          item('u2', 'update-overseas-site', 'Queried'),
          item('u3', 'update-overseas-site', 'Approved')
        ]
      }),
      request('r1', {
        sites: [item('a2', 'add-overseas-site', 'Rejected')],
        tonnage: tonnageItem('t2', 'Withdrawn')
      })
    ])

    const LIST_PAGE_URL = `${PAGE_URL}/change-requests`

    async function getSection(changes, { url = PAGE_URL, apps } = {}) {
      mockManageGets(apps ?? [makeApp()], undefined, changes)
      const response = await get(url)
      expect(response.statusCode).toBe(statusCodes.ok)
      return response.result
    }

    const summaryTypes = (html) =>
      [
        ...html.matchAll(/data-testid="change-requests-summary-row-([^"]+)"/g)
      ].map((match) => match[1])

    function summaryRow(html, changeType) {
      const marker = `data-testid="change-requests-summary-row-${changeType}"`
      const start = html.indexOf(marker)
      expect(start).toBeGreaterThan(-1)
      return html.slice(start, html.indexOf('</tr>', start))
    }

    test('sits between the summary row and the cards', async () => {
      const result = await getSection(ACTIVE_VIEW)

      const summary = result.indexOf('data-testid="accreditation-summary"')
      const section = result.indexOf('data-testid="change-requests-section"')
      const cards = result.indexOf(
        'data-testid="task-card-manage-accreditation"'
      )
      expect(summary).toBeGreaterThan(-1)
      expect(section).toBeGreaterThan(summary)
      expect(cards).toBeGreaterThan(section)
    })

    test('reads the change requests of the current accreditation', async () => {
      const getSpy = mockManageGets([makeApp()])

      await get(PAGE_URL)

      expect(getSpy).toHaveBeenCalledWith(
        `/api/v1/accreditation-changes/${ORG_ID}/app-current`
      )
    })

    test('shows a Type, Status and Action table', async () => {
      const result = await getSection(ACTIVE_VIEW)

      expect(result).toMatch(
        /data-testid="change-requests-summary-table"[\s\S]*?<th[^>]*>\s*Type\s*<\/th>\s*<th[^>]*>\s*Status\s*<\/th>\s*<th[^>]*>\s*Action\s*<\/th>/
      )
    })

    test('gives one row per type with active items, in type order, each with its most urgent active status', async () => {
      const result = await getSection(ACTIVE_VIEW)

      expect(summaryTypes(result)).toEqual([
        'add-overseas-site',
        'update-overseas-site'
      ])
      const addRow = summaryRow(result, 'add-overseas-site')
      expect(addRow).toMatch(
        /data-testid="change-requests-summary-type-add-overseas-site"[^>]*>\s*New ORS accreditation\s*</
      )
      expect(addRow).toMatch(
        /class="govuk-tag govuk-tag--green"[^>]*data-testid="change-requests-summary-status-add-overseas-site"[^>]*>\s*SUBMITTED\s*</
      )
      const updateRow = summaryRow(result, 'update-overseas-site')
      expect(updateRow).toMatch(
        /data-testid="change-requests-summary-type-update-overseas-site"[^>]*>\s*ORS update\s*</
      )
      expect(updateRow).toMatch(
        /class="govuk-tag govuk-tag--orange"[^>]*data-testid="change-requests-summary-status-update-overseas-site"[^>]*>\s*QUERIED\s*</
      )
    })

    test('gives no row to a type with only granted, refused or withdrawn items', async () => {
      const result = await getSection(ACTIVE_VIEW)

      expect(result).not.toContain(
        'data-testid="change-requests-summary-row-upgrade-tonnage-band"'
      )
      expect(result).not.toContain('data-testid="no-active-change-requests"')
    })

    test('links each row to the list filtered to its type', async () => {
      const result = await getSection(ACTIVE_VIEW)

      expect(summaryRow(result, 'add-overseas-site')).toMatch(
        new RegExp(
          `href="${LIST_PAGE_URL}\\?type=add-overseas-site"[^>]*data-testid="change-requests-summary-view-add-overseas-site"[^>]*>\\s*View<span class="govuk-visually-hidden"> New ORS accreditation</span>`
        )
      )
      expect(summaryRow(result, 'update-overseas-site')).toMatch(
        new RegExp(
          `href="${LIST_PAGE_URL}\\?type=update-overseas-site"[^>]*data-testid="change-requests-summary-view-update-overseas-site"`
        )
      )
    })

    test('keeps the Welsh path in the type links', async () => {
      const result = await getSection(ACTIVE_VIEW, { url: WELSH_PAGE_URL })

      expect(result).toContain('[Welsh] In year change requests')
      expect(summaryRow(result, 'add-overseas-site')).toContain(
        `href="/cy${LIST_PAGE_URL}?type=add-overseas-site"`
      )
    })

    test('shows a reprocessor their tonnage band upgrades', async () => {
      const result = await getSection(
        viewWith([request('r1', { tonnage: tonnageItem('t1', 'Updated') })]),
        { apps: [reprocessorApp()] }
      )

      expect(summaryTypes(result)).toEqual(['upgrade-tonnage-band'])
      expect(summaryRow(result, 'upgrade-tonnage-band')).toMatch(
        /data-testid="change-requests-summary-status-upgrade-tonnage-band"[^>]*>\s*UPDATED\s*</
      )
    })

    describe('empty state', () => {
      function expectEmptyState(result, listUrl = LIST_PAGE_URL) {
        expect(result).not.toContain(
          'data-testid="change-requests-summary-table"'
        )
        expect(result).toMatch(
          new RegExp(
            `data-testid="no-active-change-requests"[^>]*>\\s*You currently have no active change requests\\. <a href="${listUrl}" class="govuk-link" data-testid="view-change-requests-link">View change requests</a>\\.\\s*<`
          )
        )
      }

      test('with no change requests, links to the unfiltered list', async () => {
        expectEmptyState(await getSection(noChangeRequests))
      })

      test('with only granted, refused and withdrawn items', async () => {
        expectEmptyState(
          await getSection(
            viewWith([
              request('r1', {
                sites: [
                  item('a1', 'add-overseas-site', 'Approved'),
                  item('u1', 'update-overseas-site', 'Rejected')
                ],
                tonnage: tonnageItem('t1', 'Withdrawn')
              })
            ])
          )
        )
      })

      test('keeps the Welsh path in the link', async () => {
        const result = await getSection(noChangeRequests, {
          url: WELSH_PAGE_URL
        })

        expect(result).toContain(
          `href="/cy${LIST_PAGE_URL}" class="govuk-link" data-testid="view-change-requests-link"`
        )
      })

      test("ignores a previous year's accreditation's active requests", async () => {
        const result = await getSection(
          (applicationId) =>
            applicationId === 'app-last-year' ? ACTIVE_VIEW : noChangeRequests,
          {
            apps: [
              makeApp({ id: 'app-last-year', year: CURRENT_YEAR - 1 }),
              makeApp()
            ]
          }
        )

        expectEmptyState(result)
      })
    })

    // RA-492's overseas-sites page precedent: an outage of the change
    // requests leaves the rest of the page working.
    test('leaves the section out, and the rest of the page up, when the change requests cannot be read', async () => {
      const result = await getSection(apiError(statusCodes.internalServerError))

      expect(result).not.toContain('data-testid="change-requests-section"')
      expect(result).toContain('data-testid="accreditation-summary"')
      expect(result).toContain('data-testid="task-card-manage-accreditation"')
    })
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

    test("summarises the seeded exporter's active change requests", async () => {
      const { result } = await get(STUB_EXPORTER_URL)

      const statuses = [
        ...result.matchAll(
          /data-testid="change-requests-summary-status-([^"]+)"[^>]*>\s*([^<]+?)\s*</g
        )
      ].map(([, type, status]) => [type, status])
      expect(statuses).toEqual([
        ['add-overseas-site', 'IN PROGRESS'],
        ['update-overseas-site', 'QUERIED'],
        ['upgrade-tonnage-band', 'DULY MADE']
      ])
    })

    test('shows the empty state for the stub org with no change requests', async () => {
      const { result } = await get(
        `/manage/${NO_CHANGE_REQUESTS_ORG_ID}/${NO_CHANGE_REQUESTS_REGISTRATION_ID}/Plastic`
      )

      expect(result).toContain('data-testid="no-active-change-requests"')
    })

    test('shows the stub exporter', async () => {
      const { statusCode, result } = await get(STUB_EXPORTER_URL)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="manage-overseas-sites-link"')
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix(currentYear())}EX0500180001PL\\s*<`
        )
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="expiry-date"[^>]*>\\s*31 Dec ${currentYear()}\\s*<`
        )
      )
    })

    test('rolls the stub accreditation over to the new year without a reload', async () => {
      const accreditationNumber = (suffix) =>
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${suffix}EX0500180001PL\\s*<`
        )
      vi.useFakeTimers({ toFake: ['Date'] })

      vi.setSystemTime(new Date(`${CURRENT_YEAR}-12-31T23:59:59.999Z`))
      const before = await get(STUB_EXPORTER_URL)
      vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
      const after = await get(STUB_EXPORTER_URL)

      expect(before.result).toMatch(
        accreditationNumber(yearSuffix(CURRENT_YEAR))
      )
      expect(after.statusCode).toBe(statusCodes.ok)
      expect(after.result).toMatch(
        accreditationNumber(yearSuffix(CURRENT_YEAR + 1))
      )
    })

    test('shows the stub reprocessor with its site address', async () => {
      const { statusCode, result } = await get(
        `/manage/${MANAGE_EXPORTER_ORG_ID}/${MANAGE_EXPORTER_ORG_REPROCESSOR_REGISTRATION_ID}/Glass`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(
          `data-testid="page-caption"[^>]*>\\s*Manage Accreditation Test Ltd \\(${currentYear()}, Glass - Remelt\\)\\s*<`
        )
      )
      expect(result).toMatch(
        /data-testid="site-address"[^>]*>\s*Unit 18, Furnace Lane, Doncaster, DN4 5HT\s*</
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="registration-number"[^>]*>\\s*R${yearSuffix(currentYear())}ER0500180002GR\\s*<`
        )
      )
    })

    // RA-697: org 50021 has an Approved registration and no accreditation.
    test('shows the stub registration-only exporter', async () => {
      const { statusCode, result } = await get(
        `/manage/${REGISTRATION_ONLY_ORG_ID}/${REGISTRATION_ONLY_REGISTRATION_ID}/Plastic`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(
          `data-testid="page-caption"[^>]*>\\s*Registration Only Exports Ltd \\(${currentYear()}, Plastic\\)\\s*<`
        )
      )
      expect(result).toMatch(
        /data-testid="registration-status-tag"[^>]*>\s*GRANTED\s*</
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="registration-number"[^>]*>\\s*R${yearSuffix(currentYear())}EX0500210001PL\\s*<`
        )
      )
      expect(result).not.toContain('data-testid="accreditation-number"')
      expect(result).toContain('data-testid="manage-overseas-sites-link"')
    })

    test('shows the stub exporter with no change requests', async () => {
      const { statusCode, result } = await get(
        `/manage/${NO_CHANGE_REQUESTS_ORG_ID}/${NO_CHANGE_REQUESTS_REGISTRATION_ID}/Plastic`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix(currentYear())}EX0500200001PL\\s*<`
        )
      )
    })

    test.each([
      ['not Approved', MANAGE_EXPORTER_ORG_CREATED_REGISTRATION_ID],
      ['missing', MANAGE_EXPORTER_ORG_MISSING_REGISTRATION_ID]
    ])(
      'shows the service-problem page for the stub registration that is %s',
      async (_case, registrationId) => {
        const { statusCode } = await get(
          `/manage/${MANAGE_EXPORTER_ORG_ID}/${registrationId}/Wood`
        )

        expect(statusCode).toBe(statusCodes.internalServerError)
      }
    )
  })
})
