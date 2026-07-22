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
  test('filters tasks to only Queried sections', () => {
    const vm = buildQueryTaskListViewModel(makeApplication(), t)

    expect(vm.tasks).toHaveLength(1)
    expect(vm.tasks[0].testId).toBe('task-business-plan')
    expect(vm.tasks[0].statusTagText).toBe('QUERIED')
    expect(vm.tasks[0].locked).toBe(false)
  })

  test('no Queried sections yields an empty task list', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({ businessPlan: { sectionStatus: 'Completed' } }),
      t
    )
    expect(vm.tasks).toHaveLength(0)
  })

  test('multiple Queried sections are all included', () => {
    const vm = buildQueryTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'Queried' },
        businessPlan: { sectionStatus: 'Queried' }
      }),
      t
    )
    expect(vm.tasks).toHaveLength(2)
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

  test('continueUrl points to query-declaration', () => {
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
    expect(result).toContain(
      'Please provide more detail on your business plan.'
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
    expect(headers.location).toContain('/operator-accreditation/')
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
