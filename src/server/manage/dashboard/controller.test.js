import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  vi
} from 'vitest'
import Boom from '@hapi/boom'

import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { apiClient } from '../../common/api-client.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { stubApiClient } from '../../common/stub-api-client.js'
import {
  MANAGE_STUB_ORG_ID,
  MANAGE_STUB_EXPORTER_REGISTRATION_ID,
  MANAGE_STUB_REPROCESSOR_REGISTRATION_ID
} from '../../common/stub-manage-accreditations.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const ORG_ID = 'org-123'
const REGISTRATION_ID = 'REG001'
const MATERIAL = 'Plastic'
const CURRENT_YEAR = 2027
const DASHBOARD_URL = `/manage/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}`
const WELSH_DASHBOARD_URL = `/cy${DASHBOARD_URL}`

const makeApp = (overrides = {}) => ({
  id: 'app-current',
  applicationStatus: 'Approved',
  material: 'plastic',
  wasteProcessingType: 'exporter',
  registrationId: REGISTRATION_ID,
  year: CURRENT_YEAR,
  createdAt: '2026-10-01T09:00:00Z',
  applicationReference: 'APP27EX500180001PL',
  accreditationReference: 'A27EX500180001PL',
  ...overrides
})

// listApplications and getApplication both go through apiClient.get, so route
// by URL shape: a last path segment matching an application id is the
// single-application fetch, anything else is the list.
function mockAccreditationGet(apps) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    const lastSegment = url.split('/').pop()
    return apps.find((app) => app.id === lastSegment) ?? apps
  })
}

const LIST_URL = `/api/v1/accreditation-applications/${ORG_ID}`

function fetchedApplicationIds(getSpy) {
  return getSpy.mock.calls
    .map(([url]) => url)
    .filter((url) => url.startsWith(`${LIST_URL}/`))
    .map((url) => url.slice(LIST_URL.length + 1))
}

describe('#manageDashboardController', () => {
  let server
  let configOverrides = {}

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key in configOverrides ? configOverrides[key] : originalGet(key)
    )
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${CURRENT_YEAR}-06-15T12:00:00Z`))
    configOverrides = { 'featureFlags.manageOverseasSitesEnabled': true }
    operatorCanAccessOrganisation.mockImplementation(
      async (_user, orgId) => orgId === ORG_ID
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('feature flag', () => {
    test.each([DASHBOARD_URL, WELSH_DASHBOARD_URL])(
      'GET %s returns 404 when the flag is off, without reading data',
      async (url) => {
        configOverrides = { 'featureFlags.manageOverseasSitesEnabled': false }
        const getSpy = mockAccreditationGet([makeApp()])

        const { statusCode } = await server.inject({ method: 'GET', url })

        expect(statusCode).toBe(statusCodes.notFound)
        expect(getSpy).not.toHaveBeenCalled()
        expect(operatorCanAccessOrganisation).not.toHaveBeenCalled()
      }
    )
  })

  describe('organisation access', () => {
    test('returns 403 without reading data when the operator cannot access the organisation', async () => {
      const getSpy = mockAccreditationGet([makeApp()])

      const { statusCode } = await server.inject({
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
      const getSpy = mockAccreditationGet([makeApp()])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expect(statusCode).toBe(statusCodes.serviceUnavailable)
      expect(getSpy).not.toHaveBeenCalled()
    })
  })

  describe('choosing the current accreditation', () => {
    test('chooses the Approved current-year application over other years, statuses, registrations and materials', async () => {
      const getSpy = mockAccreditationGet([
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

      const { statusCode } = await server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(fetchedApplicationIds(getSpy)).toEqual(['app-current'])
    })

    test('chooses the most recent when several Approved current-year applications match', async () => {
      const getSpy = mockAccreditationGet([
        makeApp({ id: 'app-older', createdAt: '2026-09-01T00:00:00Z' }),
        makeApp({ id: 'app-newest', createdAt: '2026-11-01T00:00:00Z' }),
        makeApp({ id: 'app-middle', createdAt: '2026-10-01T00:00:00Z' })
      ])

      await server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-newest'])
    })

    test('takes the year from the clock on the last moment of the year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR}-12-31T23:59:59.999Z`))
      const getSpy = mockAccreditationGet([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-this-year'])
    })

    test('takes the year from the clock on the first moment of the next year', async () => {
      vi.setSystemTime(new Date(`${CURRENT_YEAR + 1}-01-01T00:00:00Z`))
      const getSpy = mockAccreditationGet([
        makeApp({ id: 'app-this-year' }),
        makeApp({ id: 'app-next-year', year: CURRENT_YEAR + 1 })
      ])

      await server.inject({ method: 'GET', url: DASHBOARD_URL })

      expect(fetchedApplicationIds(getSpy)).toEqual(['app-next-year'])
    })
  })

  describe('service problem', () => {
    function expectServiceProblem({ statusCode, result }, url) {
      expect(statusCode).toBe(statusCodes.serviceUnavailable)
      expect(result).toContain('data-testid="service-problem-heading"')
      expect(result).toMatch(
        new RegExp(`href="${url}"[^>]*data-testid="try-again-link"`)
      )
    }

    test('shows the service-problem page with a try-again link when no application matches', async () => {
      mockAccreditationGet([makeApp({ year: CURRENT_YEAR - 1 })])

      const response = await server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('shows the service-problem page when listing applications fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        Object.assign(new Error('boom'), { status: 500 })
      )

      const response = await server.inject({
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

      const response = await server.inject({
        method: 'GET',
        url: DASHBOARD_URL
      })

      expectServiceProblem(response, DASHBOARD_URL)
    })

    test('keeps the Welsh path in the try-again link', async () => {
      mockAccreditationGet([])

      const response = await server.inject({
        method: 'GET',
        url: WELSH_DASHBOARD_URL
      })

      expectServiceProblem(response, WELSH_DASHBOARD_URL)
    })
  })

  describe('dashboard content', () => {
    let result

    beforeEach(async () => {
      mockAccreditationGet([makeApp()])
      const response = await server.inject({
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

    test('shows the accreditation number', () => {
      expect(result).toMatch(
        /data-testid="accreditation-number"[^>]*>\s*A27EX500180001PL\s*</
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
    mockAccreditationGet([makeApp({ wasteProcessingType: 'reprocessor' })])

    const { statusCode, result } = await server.inject({
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
    mockAccreditationGet([makeApp()])

    const { statusCode } = await server.inject({
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
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/manage/${MANAGE_STUB_ORG_ID}/${MANAGE_STUB_EXPORTER_REGISTRATION_ID}/Plastic`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix()}EX500180001PL\\s*<`
        )
      )
    })

    test('shows the stub reprocessor accreditation', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/manage/${MANAGE_STUB_ORG_ID}/${MANAGE_STUB_REPROCESSOR_REGISTRATION_ID}/Glass`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        /data-testid="page-heading"[^>]*>\s*Glass - Remelt\s*</
      )
      expect(result).toMatch(
        new RegExp(
          `data-testid="accreditation-number"[^>]*>\\s*A${yearSuffix()}ER500180002GL\\s*<`
        )
      )
    })
  })

  test('renders under the Welsh path with Welsh-prefixed links', async () => {
    mockAccreditationGet([makeApp()])

    const { statusCode, result } = await server.inject({
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
