import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import Boom from '@hapi/boom'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import { apiClient } from '../common/api-client.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { buildLandingViewModel } from './controller.js'

// The controller delegates the access decision to operatorCanAccessOrganisation
// (resolve-linked-id + relationship check + fail-closed), which is unit-tested in
// reex-organisation-service. Here we stub it to allow the URL org (org-123) and
// deny any other org (not-my-org).
vi.mock('../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const ORG_ID = 'org-123'
const REGISTRATION_ID = 'REG001'
const MATERIAL = 'Steel'
const YEAR = 2026

const makeApp = (overrides = {}) => ({
  applicationId: 'app-id-001',
  applicationStatus: 'Saved',
  materialType: MATERIAL,
  registrationId: REGISTRATION_ID,
  year: YEAR,
  ...overrides
})

describe('#buildLandingViewModel', () => {
  const t = (key) => key.split('.').pop()

  test('Saved maps to grey tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Saved' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--grey')
  })

  test('Started maps to blue tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Started' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--blue')
  })

  test('Submitted maps to green tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Submitted' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--green')
  })

  test('Queried maps to orange tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Queried' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--orange')
  })

  test('Approved maps to green tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Approved' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--green')
  })

  test('Rejected maps to red tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Rejected' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--red')
  })

  test('unknown status maps to empty tagClass', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('')
  })

  test('siteName uses SiteAddr when present', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.siteName).toBe('siteAddr')
  })

  test('siteName falls back to translation key when is null', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Unknown' }),
      'Org Name',
      null,
      2027,
      t
    )
    expect(vm.siteName).toBe('siteNotSet')
  })

  test('taskListUrl contains applicationId', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationId: 'app-xyz' }),
      'Org',
      null,
      2027,
      t
    )
    expect(vm.taskListUrl).toBe('/accreditation/task-list/app-xyz')
  })

  test('materialDisplay comes from translation', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Steel')
  })

  test('glass with glass_re_melt process uses the remelt display name', () => {
    const vm = buildLandingViewModel(
      makeApp({
        materialType: 'Glass',
        glassRecyclingProcess: 'glass_re_melt'
      }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('glassRemelt')
  })

  test('glass with glass_other process uses the other display name', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Glass', glassRecyclingProcess: 'glass_other' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('glassOther')
  })

  test('glass with no recycling process falls back to the generic material name', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Glass' }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Glass')
  })

  test('non-glass material ignores glassRecyclingProcess entirely', () => {
    const vm = buildLandingViewModel(
      makeApp({
        materialType: 'Steel',
        glassRecyclingProcess: 'glass_re_melt'
      }),
      'Org',
      'siteAddr',
      2027,
      t
    )
    expect(vm.materialDisplay).toBe('Steel')
  })

  test('organisationName is passed through', () => {
    const vm = buildLandingViewModel(
      makeApp({ materialType: 'Steel' }),
      'Organisation Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.organisationName).toBe('Organisation Name')
  })

  test('notificationFailedBanner is true when notificationStatus is failed', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: 'failed' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(true)
  })

  test('notificationFailedBanner is false when notificationStatus is sent', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: 'sent' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(false)
  })

  test('notificationFailedBanner is false when notificationStatus is null', () => {
    const vm = buildLandingViewModel(
      makeApp({ notificationStatus: null }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.notificationFailedBanner).toBe(false)
  })

  test('notificationFailedBanner is false when notificationStatus is absent', () => {
    const vm = buildLandingViewModel(makeApp(), 'Org Name', 'siteAddr', 2027, t)
    expect(vm.notificationFailedBanner).toBe(false)
  })
})

describe('#operatorAccreditationController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    operatorCanAccessOrganisation.mockImplementation(
      async (_user, orgId) => orgId === ORG_ID
    )
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  const baseUrl = `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`

  test('returns 403 when operator is not related to the organisation', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/operator-accreditation/not-my-org/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(getSpy).not.toHaveBeenCalled()
    expect(postSpy).not.toHaveBeenCalled()
  })

  test('renders the service-unavailable page (503) when the access check is unavailable', async () => {
    operatorCanAccessOrganisation.mockRejectedValueOnce(
      Boom.serverUnavailable()
    )
    const getSpy = vi.spyOn(apiClient, 'get')

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.serviceUnavailable)
    expect(result).toContain('the service is unavailable')
    expect(getSpy).not.toHaveBeenCalled()
  })

  test('returns 200 when existing application found for site/material/year', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Started' })
    ])
    vi.spyOn(apiClient, 'post').mockResolvedValue({})

    const { statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('does not call seed when matching application already exists', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(postSpy).not.toHaveBeenCalled()
  })

  test('calls seedApplication when no matching application found for site/material/year', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ registrationId: 'other-ref' })
    ])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(makeApp())

    await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/${REGISTRATION_ID}/${MATERIAL}/seed`),
      expect.objectContaining({ year: YEAR })
    )
  })

  test('returns 200 after successful seed when no application exists', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([])
    vi.spyOn(apiClient, 'post').mockResolvedValue(makeApp())

    const { statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders Not Set site name in summary', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="site-name"')
    expect(result).toContain('Not set')
  })

  test('renders material display in summary', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="material-display"')
    expect(result).toContain('Steel')
  })

  test('renders status tag with correct class for Started', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Started' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('govuk-tag--blue')
    expect(result).toContain('IN PROGRESS')
  })

  test('reapply text is shown when application status is Saved', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Saved' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is shown when application status is Started', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Started' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is NOT shown when application status is Submitted', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Submitted' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is NOT shown when application status is Approved', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Approved' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('reapply text is NOT shown when application status is Rejected', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ applicationStatus: 'Rejected' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain(
      'You can now reapply for accreditation for this material.'
    )
  })

  test('Continue button links to task-list with applicationId', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="continue-button"')
    expect(result).toContain('/accreditation/task-list/app-id-001')
  })

  test('Re/Ex back link is present', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="reex-back-link"')
  })

  test('application summary list is rendered', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="application-summary"')
  })

  test('multi-application list is not rendered', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="applications-list"')
  })

  test('renders notification status row when notificationStatus is failed', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ notificationStatus: 'failed' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="notification-status"')
    expect(result).toContain('Failed to send')
  })

  test('does not render notification status row when notificationStatus is sent', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ notificationStatus: 'sent' })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('does not render notification status row when notificationStatus is null', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([
      makeApp({ notificationStatus: null })
    ])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('does not render notification status row when notificationStatus is absent', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).not.toContain('data-testid="notification-status"')
  })

  test('returns 500 error view when listApplications throws', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="error-message"')
    expect(result).toContain('We were unable to start your application')
  })

  test('error view renders back link with non-empty href', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

    const { result } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="reex-back-link"')
    expect(result).not.toContain('href=""')
  })

  test('returns 500 error view when seedApplication throws', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([])
    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('seed failed'))

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="error-message"')
  })

  test('year URL param is compared as integer against app.year', async () => {
    const app2026 = makeApp({ year: 2026 })
    const app2025 = makeApp({ applicationId: 'app-2025', year: 2025 })
    vi.spyOn(apiClient, 'get').mockResolvedValue([app2025, app2026])

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/2026`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('returns 200 in Welsh locale', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/cy/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh]')
  })

  const makeExporterApp = (overrides = {}) => ({
    applicationId: 'app-exp-001',
    applicationStatus: 'Saved',
    materialType: MATERIAL,
    registrationId: REGISTRATION_ID,
    isExporter: true,
    year: YEAR,
    organisationName: 'Exporter Co',
    ...overrides
  })

  const exporterUrl = `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/exporter`

  describe('GET /operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}/exporter', () => {
    test('returns 403 when operator is not related to the organisation', async () => {
      const getSpy = vi
        .spyOn(apiClient, 'get')
        .mockResolvedValue([makeExporterApp()])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/operator-accreditation/not-my-org/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/exporter`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(getSpy).not.toHaveBeenCalled()
    })

    test('returns 200 when existing exporter application found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeExporterApp()])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('does not call seed when matching exporter application already exists', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeExporterApp()])
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(postSpy).not.toHaveBeenCalled()
    })

    test('calls seedApplication when no matching exporter app found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(makeExporterApp())

      await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/${REGISTRATION_ID}/${MATERIAL}/seed`),
        expect.objectContaining({ year: YEAR })
      )
    })

    test('does NOT render site row for exporter', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeExporterApp()])

      const { result } = await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="site-name"')
    })

    test('renders application summary without site row', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeExporterApp()])

      const { result } = await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="application-summary"')
      expect(result).toContain('data-testid="material-display"')
      expect(result).toContain('data-testid="continue-button"')
    })

    test('reprocessor route still renders site row', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

      const { result } = await server.inject({
        method: 'GET',
        url: `/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="site-name"')
    })

    test('returns 500 when listApplications throws', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-message"')
    })

    test('returns 500 when seed throws', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('seed failed'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: exporterUrl,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-message"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([makeExporterApp()])

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/operator-accreditation/${ORG_ID}/${REGISTRATION_ID}/${MATERIAL}/${YEAR}/exporter`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
