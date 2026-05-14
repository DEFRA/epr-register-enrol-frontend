import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'
import { apiClient } from '../common/api-client.js'
import { buildLandingViewModel } from './controller.js'

const ORG_ID = 'org-123'
const SITE_ID = 'site001'
const MATERIAL = 'Steel'
const YEAR = 2026

const makeApp = (overrides = {}) => ({
  applicationId: 'app-id-001',
  applicationStatus: 'Saved',
  materialType: MATERIAL,
  siteId: SITE_ID,
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

  test('Sent maps to turquoise tag', () => {
    const vm = buildLandingViewModel(
      makeApp({ applicationStatus: 'Sent' }),
      'Org Name',
      'siteAddr',
      2027,
      t
    )
    expect(vm.statusTagClass).toBe('govuk-tag--turquoise')
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
  })

  const operatorHeaders = {
    Authorization: 'Basic dGVzdDp0ZXN0MTIz',
    'x-test-user-type': 'operator'
  }

  const baseUrl = `/operator-accreditation/${ORG_ID}/${SITE_ID}/${MATERIAL}/${YEAR}`

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
      makeApp({ siteId: 'other-site' })
    ])
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(makeApp())

    await server.inject({
      method: 'GET',
      url: baseUrl,
      headers: operatorHeaders
    })

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/${SITE_ID}/${MATERIAL}/seed`),
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
      url: `/operator-accreditation/${ORG_ID}/${SITE_ID}/${MATERIAL}/2026`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  test('returns 200 in Welsh locale', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([makeApp()])

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/cy/operator-accreditation/${ORG_ID}/${SITE_ID}/${MATERIAL}/${YEAR}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('[Welsh]')
  })
})
