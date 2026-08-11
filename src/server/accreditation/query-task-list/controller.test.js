import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../server.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { apiClient } from '../../common/api-client.js'
import { buildQueryTaskListViewModel } from './controller.js'

const APPLICATION_ID = 'app-query-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    registrationId: 'test-registration-id',
    materialType: 'Steel',
    year: 2027,
    applicationStatus: 'Queried',
    query: { queryNote: 'Please provide more detail on your business plan.' },
    prns: { sectionStatus: 'Completed' },
    businessPlan: { sectionStatus: 'Queried' },
    samplingPlan: { sectionStatus: 'Completed' },
    ...overrides
  }
}

describe('#buildQueryTaskListViewModel', () => {
  test('renders all sections, unlocking only the Queried one', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)

    expect(vm.tasks).toHaveLength(3)

    const businessPlan = vm.tasks.find((t) => t.testId === 'task-business-plan')
    expect(businessPlan.statusTagText).toBe('QUERIED')
    expect(businessPlan.locked).toBe(false)
    expect(businessPlan.url).toBe(
      `/accreditation/business-plan/${APPLICATION_ID}`
    )

    const prns = vm.tasks.find((t) => t.testId === 'task-prns')
    expect(prns.locked).toBe(true)
    expect(prns.url).toBeNull()

    const samplingPlan = vm.tasks.find((t) => t.testId === 'task-sampling-plan')
    expect(samplingPlan.locked).toBe(true)
    expect(samplingPlan.url).toBeNull()
  })

  test('no Queried sections locks every task', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({ businessPlan: { sectionStatus: 'Completed' } }),
      t
    )
    expect(vm.tasks).toHaveLength(3)
    expect(vm.tasks.every((task) => task.locked)).toBe(true)
    expect(vm.tasks.every((task) => task.url === null)).toBe(true)
  })

  test('multiple Queried sections are all unlocked', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'Queried' },
        businessPlan: { sectionStatus: 'Queried' }
      }),
      t
    )
    expect(vm.tasks).toHaveLength(3)
    const unlocked = vm.tasks.filter((task) => !task.locked)
    expect(unlocked.map((task) => task.testId).sort()).toEqual([
      'task-business-plan',
      'task-prns'
    ])
  })

  test('exposes queryNote from application.query', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)
    expect(vm.queryNote).toBe(
      'Please provide more detail on your business plan.'
    )
  })

  test('queryNote is null when application.query is absent', () => {
    const vm = buildQueryTaskListViewModel(makeApplication({ query: null }), t)
    expect(vm.queryNote).toBeNull()
  })

  test('continueUrl points directly to query-declaration', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)
    expect(vm.continueUrl).toBe(
      `/accreditation/query-declaration/${APPLICATION_ID}`
    )
  })

  test('exporter journey includes overseas sites and BES evidence when Queried', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({
        isExporter: true,
        overseasSites: { sectionStatus: 'Queried' },
        besEvidence: { sectionStatus: 'Queried' }
      }),
      t
    )
    const testIds = vm.tasks.map((task) => task.testId)
    expect(testIds).toContain('task-overseas-sites')
    expect(testIds).toContain('task-bes-evidence')
  })

  // Material is no longer duplicated on this page's own heading — it's
  // shown once, in the persistent application-header (see
  // src/server/common/helpers/applicationHeader.js).
  test('heading is the reapply prompt, not tied to material', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)
    expect(vm.heading).toBe('headingPrefix')
  })

  test('exporter heading uses the exporter-specific prefix', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({ isExporter: true }),
      t
    )
    expect(vm.heading).toBe('headingPrefixExporter')
  })
})

describe('#queryTaskListGetController', () => {
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

  test('returns 200 and renders the queried section and query note', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('data-testid="task-business-plan"')
    expect(result).toContain('data-testid="regulator-query-banner"')
    expect(result).toContain(
      'Please provide more detail on your business plan.'
    )
  })

  test('continue button links directly to query-declaration', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

    const { result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(result).toContain(
      `href="/accreditation/query-declaration/${APPLICATION_ID}"`
    )
  })

  test('redirects to the landing page when applicationStatus is not Queried', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      makeApplication({ applicationStatus: 'Submitted' })
    )

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(
      '/operator-accreditation/test-operator-id/test-registration-id/Steel/2027'
    )
  })

  test('redirect never contains "undefined", even with no session set for this journey', async () => {
    // Regression guard: a query-response journey can outlive the session
    // values written when the landing page was first visited. The redirect
    // must be built from the fetched application, not request.yar.
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      makeApplication({ applicationStatus: 'Submitted' })
    )

    const { headers } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(headers.location).not.toContain('undefined')
  })

  test('non-queried sections render as locked, read-only text with no link', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

    const { result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="task-prns-label"')
    expect(result).not.toContain('data-testid="task-prns-link"')
    expect(result).not.toContain(`/accreditation/tonnage/${APPLICATION_ID}`)
    expect(result).toContain('data-testid="task-business-plan-link"')
    expect(result).toContain(
      `href="/accreditation/business-plan/${APPLICATION_ID}"`
    )
  })

  test('renders all 5 task items for a Queried exporter application with every section queried', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      makeApplication({
        isExporter: true,
        prns: { sectionStatus: 'Queried' },
        businessPlan: { sectionStatus: 'Queried' },
        samplingPlan: { sectionStatus: 'Queried' },
        overseasSites: { sectionStatus: 'Queried' },
        besEvidence: { sectionStatus: 'Queried' }
      })
    )

    const { result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="task-prns"')
    expect(result).toContain('data-testid="task-business-plan"')
    expect(result).toContain('data-testid="task-sampling-plan"')
    expect(result).toContain('data-testid="task-overseas-sites"')
    expect(result).toContain('data-testid="task-bes-evidence"')
  })

  test('returns 500 with error summary when API fetch fails', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="error-summary"')
  })
})
