import { describe, test, expect, beforeEach, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_DASHBOARD_URL as DASHBOARD_URL,
  apiError,
  approvedRegistration,
  makeManageApp as makeApp,
  mockManageGets
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'
import { currentYear } from '../../common/helpers/currentYear.js'
import {
  MANAGE_TEST_ORG_ID,
  MANAGE_TEST_EXPORTER_REGISTRATION_ID,
  MANAGE_TEST_REPROCESSOR_REGISTRATION_ID,
  MANAGE_TEST_CREATED_REGISTRATION_ID
} from '../../common/constants/test-orgs.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const PAGE_URL = `${DASHBOARD_URL}/registration-accreditation`
const WELSH_PAGE_URL = `/cy${PAGE_URL}`

const reprocessorApp = () => makeApp({ wasteProcessingType: 'reprocessor' })

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
    }
  )

  test('returns 403 without reading data when the operator cannot access the organisation', async () => {
    const getSpy = mockManageGets([makeApp()])

    const { statusCode } = await get(
      `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}/registration-accreditation`
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

    test('links back to the dashboard', () => {
      expect(result).toMatch(
        new RegExp(`href="${DASHBOARD_URL}"[^>]*data-testid="back-link"`)
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
        `href="${DASHBOARD_URL}/overseas-sites"[^>]*data-testid="manage-overseas-sites-link"`
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
      new RegExp(`href="/cy${DASHBOARD_URL}"[^>]*data-testid="back-link"`)
    )
    expect(result).toMatch(
      new RegExp(
        `href="/cy${DASHBOARD_URL}/overseas-sites"[^>]*data-testid="manage-overseas-sites-link"`
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
      const { statusCode, result } = await get(
        `/manage/${MANAGE_TEST_ORG_ID}/${MANAGE_TEST_EXPORTER_REGISTRATION_ID}/Plastic/registration-accreditation`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="manage-overseas-sites-link"')
      expect(result).toMatch(
        new RegExp(
          `data-testid="expiry-date"[^>]*>\\s*31 Dec ${currentYear()}\\s*<`
        )
      )
    })

    test('shows the stub reprocessor with its site address', async () => {
      const { statusCode, result } = await get(
        `/manage/${MANAGE_TEST_ORG_ID}/${MANAGE_TEST_REPROCESSOR_REGISTRATION_ID}/Glass/registration-accreditation`
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
    })

    test('shows the service-problem page for the stub registration that is not Approved', async () => {
      const { statusCode } = await get(
        `/manage/${MANAGE_TEST_ORG_ID}/${MANAGE_TEST_CREATED_REGISTRATION_ID}/Wood/registration-accreditation`
      )

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })
})
