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
import { apiClient } from '../../common/api-client.js'
import { config } from '../../../config/config.js'
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
  test('the Queried section is unlocked and editable', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)

    expect(vm.tasks).toHaveLength(3)

    const businessPlan = vm.tasks.find((t) => t.testId === 'task-business-plan')
    expect(businessPlan.statusTagText).toBe('QUERIED')
    expect(businessPlan.locked).toBe(false)
    expect(businessPlan.readOnly).toBe(false)
    expect(businessPlan.url).toBe(
      `/accreditation/business-plan/${APPLICATION_ID}`
    )
  })

  test('Completed/Submitted sections that are not the queried one are unlocked but read-only', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)

    const prns = vm.tasks.find((t) => t.testId === 'task-prns')
    expect(prns.locked).toBe(false)
    expect(prns.readOnly).toBe(true)
    expect(prns.url).toBe(`/accreditation/tonnage/${APPLICATION_ID}`)

    const samplingPlan = vm.tasks.find((t) => t.testId === 'task-sampling-plan')
    expect(samplingPlan.locked).toBe(false)
    expect(samplingPlan.readOnly).toBe(true)
    expect(samplingPlan.url).toBe(
      `/accreditation/sampling-plan/${APPLICATION_ID}`
    )
  })

  test('NotStarted/InProgress sections stay locked with no link', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'NotStarted' },
        samplingPlan: { sectionStatus: 'InProgress' }
      }),
      t
    )
    const prns = vm.tasks.find((t) => t.testId === 'task-prns')
    expect(prns.locked).toBe(true)
    expect(prns.readOnly).toBe(false)
    expect(prns.url).toBeNull()

    const samplingPlan = vm.tasks.find((t) => t.testId === 'task-sampling-plan')
    expect(samplingPlan.locked).toBe(true)
    expect(samplingPlan.url).toBeNull()
  })

  test('multiple Queried sections are all unlocked and editable', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'Queried' },
        businessPlan: { sectionStatus: 'Queried' }
      }),
      t
    )
    expect(vm.tasks).toHaveLength(3)
    const editable = vm.tasks.filter((task) => !task.locked && !task.readOnly)
    expect(editable.map((task) => task.testId).sort()).toEqual([
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

  test('queryNote is null when REGULATOR_QUERY_TEXT_DISABLED is true', () => {
    const originalConfigGet = config.get.bind(config)
    const configSpy = vi
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'regulatorQuery.textDisabled' ? true : originalConfigGet(key)
      )

    try {
      const vm = buildQueryTaskListViewModel(makeApplication(), t)
      expect(vm.queryNote).toBeNull()
    } finally {
      configSpy.mockRestore()
    }
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

  test('hides the regulator-query banner when REGULATOR_QUERY_TEXT_DISABLED is true', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
    const originalConfigGet = config.get.bind(config)
    const configSpy = vi
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'regulatorQuery.textDisabled' ? true : originalConfigGet(key)
      )

    try {
      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/query-task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="regulator-query-banner"')
      expect(result).not.toContain(
        'Please provide more detail on your business plan.'
      )
    } finally {
      configSpy.mockRestore()
    }
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

  test('Completed non-queried sections render as clickable, read-only links', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

    const { result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="task-prns-link"')
    expect(result).toContain(`href="/accreditation/tonnage/${APPLICATION_ID}"`)
    expect(result).toContain('data-testid="task-business-plan-link"')
    expect(result).toContain(
      `href="/accreditation/business-plan/${APPLICATION_ID}"`
    )
  })

  test('NotStarted non-queried sections render as locked, read-only text with no link', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      makeApplication({ prns: { sectionStatus: 'NotStarted' } })
    )

    const { result } = await server.inject({
      method: 'GET',
      url: `/accreditation/query-task-list/${APPLICATION_ID}`,
      headers: operatorHeaders
    })

    expect(result).toContain('data-testid="task-prns-label"')
    expect(result).not.toContain('data-testid="task-prns-link"')
    expect(result).not.toContain(`/accreditation/tonnage/${APPLICATION_ID}`)
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
