import { describe, test, expect, beforeEach, vi } from 'vitest'
import Boom from '@hapi/boom'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
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
  mockManageGets
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
  NO_CHANGE_REQUESTS_REGISTRATION_ID
} from '../../common/constants/test-orgs.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const WELSH_PAGE_URL = `/cy${PAGE_URL}`

const REGISTRATION_STATUS_URL = `/api/v1/registrations/${REGISTRATION_ID}/status`

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

    test('when there is no Approved current-year accreditation', async () => {
      mockManageGets([
        makeApp({ year: CURRENT_YEAR - 1 }),
        makeApp({ id: 'app-started', applicationStatus: 'Started' })
      ])

      expectServiceProblem(await get(PAGE_URL))
    })

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

  test('asks for the status of the registration in the URL', async () => {
    const getSpy = mockManageGets([makeApp()])

    await get(PAGE_URL)

    expect(getSpy).toHaveBeenCalledWith(REGISTRATION_STATUS_URL)
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

  test('gives the card titles h2 headings, as nothing sits between them and the h1', async () => {
    mockManageGets([makeApp()])

    const { result } = await get(PAGE_URL)

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

  describe('with the frontend stub API', () => {
    beforeEach(() => {
      vi.useRealTimers()
      vi.spyOn(apiClient, 'get').mockImplementation((url) =>
        stubApiClient.get(url)
      )
      operatorCanAccessOrganisation.mockResolvedValue(true)
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
