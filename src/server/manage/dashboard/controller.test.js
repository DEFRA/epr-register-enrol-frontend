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
  MANAGE_DASHBOARD_URL as DASHBOARD_URL,
  apiError,
  approvedRegistration,
  makeManageApp as makeApp,
  mockManageGets
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'
import {
  MANAGE_STUB_ORG_ID,
  MANAGE_STUB_EXPORTER_REGISTRATION_ID,
  MANAGE_STUB_REPROCESSOR_REGISTRATION_ID,
  MANAGE_STUB_CREATED_REGISTRATION_ID,
  MANAGE_STUB_MISSING_REGISTRATION_ID
} from '../../common/stub-manage-accreditations.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const WELSH_DASHBOARD_URL = `/cy${DASHBOARD_URL}`

const REGISTRATION_STATUS_URL = `/api/v1/registrations/${REGISTRATION_ID}/status`

const LIST_URL = `/api/v1/accreditation-applications/${ORG_ID}`

function fetchedApplicationIds(getSpy) {
  return getSpy.mock.calls
    .map(([url]) => url)
    .filter((url) => url.startsWith(`${LIST_URL}/`))
    .map((url) => url.slice(LIST_URL.length + 1))
}

describe('#manageDashboardController', () => {
  const page = setupManagePageServer()

  describe('feature flag', () => {
    test.each([DASHBOARD_URL, WELSH_DASHBOARD_URL])(
      'GET %s returns 404 when the flag is off, without reading data',
      async (url) => {
        page.setInYearChangesEnabled(false)
        const getSpy = mockManageGets([makeApp()])

        const { statusCode } = await page.server.inject({ method: 'GET', url })

        expect(statusCode).toBe(statusCodes.notFound)
        expect(getSpy).not.toHaveBeenCalled()
        expect(operatorCanAccessOrganisation).not.toHaveBeenCalled()
      }
    )
  })

  describe('organisation access', () => {
    test('returns 403 without reading data when the operator cannot access the organisation', async () => {
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await page.server.inject({
        method: 'GET',
        url: `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}`
      })

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(getSpy).not.toHaveBeenCalled()
    })

    test('returns the service-unavailable page when the access check is unavailable', async () => {
      operatorCanAccessOrganisation.mockRejectedValueOnce(
        Boom.serverUnavailable()
      )
      const getSpy = mockManageGets([makeApp()])

      const { statusCode } = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

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

      const { statusCode } = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(fetchedApplicationIds(getSpy)).toEqual(['app-current'])
    })

    test('chooses the most recent when several Approved current-year applications match', async () => {
      const getSpy = mockManageGets([
        makeApp({ id: 'app-older', createdAt: '2026-09-01T00:00:00Z' }),
        makeApp({ id: 'app-newest', createdAt: '2026-11-01T00:00:00Z' }),
        makeApp({ id: 'app-middle', createdAt: '2026-10-01T00:00:00Z' })
      ])

      await page.server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-newest'])
    })

    test('takes the year from the clock on the last moment of the year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR}-12-31T23:59:59.999Z`))
      const getSpy = mockManageGets([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await page.server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-this-year'])
    })

    test('takes the year from the clock on the first moment of the next year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
      const getSpy = mockManageGets([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await page.server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-next-year'])
    })
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }, url) {
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="service-problem-heading"')
      expect(result).toMatch(
        new RegExp(`href="${url}"[^>]*data-testid="try-again-link"`)
      )
    }

    test('shows the service-problem page with a try-again link when no application matches', async () => {
      mockManageGets([makeApp({ year: CURRENT_YEAR - 1 })])

      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('shows the service-problem page when listing applications fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        Object.assign(new Error('boom'), { status: 500 })
      )

      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('shows the service-problem page when fetching the chosen application fails', async () => {
      const apps = [makeApp()]
      vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
        if (url.endsWith('/app-current')) {
          throw Object.assign(new Error('boom'), { status: 502 })
        }
        return apps
      })

      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('keeps the Welsh path in the try-again link', async () => {
      mockManageGets([])

      const response = await page.server.inject({
        method: 'GET',
        url: WELSH_DASHBOARD_URL
      })

      expectServiceProblem(response, WELSH_DASHBOARD_URL)
    })

    test.each(['Created', 'Rejected', 'Cancelled'])(
      'shows the service-problem page when the registration is %s',
      async (status) => {
        mockManageGets([makeApp()], { ...approvedRegistration, status })

        const response = await page.server.inject({
          method: 'GET',
          url: DASHBOARD_URL
        })

        expectServiceProblem(response, DASHBOARD_URL)
      }
    )

    test('shows the service-problem page when the registration has no record', async () => {
      mockManageGets([makeApp()], apiError(statusCodes.notFound))

      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('shows the service-problem page when the registration-status call fails', async () => {
      mockManageGets([makeApp()], apiError(statusCodes.internalServerError))

      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })
  })

  test('asks for the status of the registration in the URL', async () => {
    const getSpy = mockManageGets([makeApp()])

    await page.server.inject({ method: 'GET', url: DASHBOARD_URL })

    expect(getSpy).toHaveBeenCalledWith(REGISTRATION_STATUS_URL)
  })

  describe('dashboard content', () => {
    let result

    beforeEach(async () => {
      mockManageGets([makeApp()])
      const response = await page.server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })
      expect(response.statusCode).toBe(statusCodes.ok)
      result = response.result
    })

    test('uses the material display name as the heading', () => {
      expect(result).toMatch(/data-testid="page-heading"[^>]*>\s*Plastic\s*</)
    })

    test('shows the accreditation status with the re-accreditation status tag', () => {
      expect(result).toMatch(
        /class="govuk-tag govuk-tag--green"[^>]*data-testid="accreditation-status-tag"[^>]*>\s*GRANTED\s*</
      )
    })

    test('shows the registration status as an Approved tag', () => {
      expect(result).toMatch(
        /class="govuk-tag govuk-tag--green"[^>]*data-testid="registration-status-tag"[^>]*>\s*Approved\s*</
      )
    })

    test('shows the registration number', () => {
      expect(result).toMatch(
        /data-testid="registration-number"[^>]*>\s*R27EX0500180001PL\s*</
      )
    })

    test('shows the accreditation number', () => {
      expect(result).toMatch(
        /data-testid="accreditation-number"[^>]*>\s*A27EX0500180001PL\s*</
      )
    })

    test('shows the waste balance as not available', () => {
      expect(result).toMatch(
        /data-testid="waste-balance-value"[^>]*>\s*Not available\s*</
      )
    })

    test('shows all four task cards', () => {
      for (const card of [
        'summary-log',
        'perns',
        'reports',
        'registration-accreditation'
      ]) {
        expect(result).toContain(`data-testid="task-card-${card}"`)
      }
    })

    test.each([
      'upload-summary-log-link',
      'create-pern-link',
      'manage-perns-link',
      'manage-reports-link'
    ])('renders %s as an inactive link that does not navigate', (testId) => {
      const anchor = result.match(
        new RegExp(`<a[^>]*data-testid="${testId}"[^>]*>`)
      )?.[0]
      expect(anchor).toBeDefined()
      expect(anchor).toContain('govuk-link')
      expect(anchor).not.toContain('href=')
    })

    test('links to the manage registration and accreditation page', () => {
      expect(result).toMatch(
        new RegExp(
          `href="${DASHBOARD_URL}/registration-accreditation"[^>]*data-testid="manage-registration-accreditation-link"`
        )
      )
    })

    test('links to the contact page', () => {
      expect(result).toMatch(
        /href="\/contact"[^>]*data-testid="contact-regulator-link"/
      )
    })

    test('links back to the Re/Ex registration page', () => {
      expect(result).toMatch(
        new RegExp(
          `href="https://reex.example.test/organisations/${ORG_ID}/registrations/${REGISTRATION_ID}"[^>]*data-testid="back-link"`
        )
      )
    })
  })

  test('shows the same dashboard for a reprocessor', async () => {
    mockManageGets([makeApp({ wasteProcessingType: 'reprocessor' })])

    const { statusCode, result } = await page.server.inject({
      method: 'GET',
      url: DASHBOARD_URL
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(
      'data-testid="task-card-registration-accreditation"'
    )
    expect(result).toContain('data-testid="accreditation-number"')
  })

  test('accepts the lowercase material slug Re/Ex links with', async () => {
    mockManageGets([makeApp()])

    const { statusCode } = await page.server.inject({
      method: 'GET',
      url: `/manage/${ORG_ID}/${REGISTRATION_ID}/plastic`
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('with the frontend stub API', () => {
    beforeEach(() => {
      vi.useRealTimers()
      vi.spyOn(apiClient, 'get').mockImplementation((url) =>
        stubApiClient.get(url)
      )
      operatorCanAccessOrganisation.mockResolvedValue(true)
    })

    const yearSuffix = () => String(new Date().getUTCFullYear()).slice(-2)

    test('shows the stub exporter accreditation', async () => {
      const { statusCode, result } = await page.server.inject({
        method: 'GET',
        url: `/manage/${MANAGE_STUB_ORG_ID}/${MANAGE_STUB_EXPORTER_REGISTRATION_ID}/Plastic`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix()}EX0500180001PL\\s*<`
        )
      )
    })

    test('shows the stub reprocessor accreditation', async () => {
      const { statusCode, result } = await page.server.inject({
        method: 'GET',
        url: `/manage/${MANAGE_STUB_ORG_ID}/${MANAGE_STUB_REPROCESSOR_REGISTRATION_ID}/Glass`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*Glass - Remelt\s*</
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix()}ER0500180002GR\\s*<`
        )
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="registration-number"[^>]*>\\s*R${yearSuffix()}ER0500180002GR\\s*<`
        )
      )
      expect(result).toMatch(
        /data-testid="registration-status-tag"[^>]*>\s*Approved\s*</
      )
    })

    test.each([
      ['not Approved', MANAGE_STUB_CREATED_REGISTRATION_ID],
      ['missing', MANAGE_STUB_MISSING_REGISTRATION_ID]
    ])(
      'shows the service-problem page for the stub registration that is %s',
      async (_case, registrationId) => {
        const { statusCode } = await page.server.inject({
          method: 'GET',
          url: `/manage/${MANAGE_STUB_ORG_ID}/${registrationId}/Wood`
        })

        expect(statusCode).toBe(statusCodes.internalServerError)
      }
    )
  })

  test('renders under the Welsh path with Welsh-prefixed links', async () => {
    mockManageGets([makeApp()])

    const { statusCode, result } = await page.server.inject({
      method: 'GET',
      url: WELSH_DASHBOARD_URL
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh] Choose a task')
    expect(result).toMatch(
      new RegExp(
        `href="${WELSH_DASHBOARD_URL}/registration-accreditation"[^>]*data-testid="manage-registration-accreditation-link"`
      )
    )
    expect(result).toMatch(
      /href="\/cy\/contact"[^>]*data-testid="contact-regulator-link"/
    )
  })
})
