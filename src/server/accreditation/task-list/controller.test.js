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
import { buildTaskListViewModel } from './controller.js'

const APPLICATION_ID = 'app-steel-001'
const CURRENT_YEAR = new Date().getFullYear()

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: CURRENT_YEAR,
    siteId: 'site-abc',
    prns: { sectionStatus: 'NotStarted' },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildTaskListViewModel', () => {
  test('all sections NotStarted — tasks tagged NOT STARTED, business plan and sampling plan locked', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)

    expect(vm.tasks[0].statusTagText).toBe('NOT STARTED')
    expect(vm.tasks[0].locked).toBe(false)
    expect(vm.tasks[0].url).toContain('/tonnage/')

    expect(vm.tasks[1].statusTagText).toBe('NOT STARTED')
    expect(vm.tasks[1].locked).toBe(true)
    expect(vm.tasks[1].url).toBeNull()

    expect(vm.tasks[2].statusTagText).toBe('NOT STARTED')
    expect(vm.tasks[2].locked).toBe(true)
    expect(vm.tasks[2].url).toBeNull()

    expect(vm.allComplete).toBe(false)
    expect(vm.continueUrl).toBeNull()
  })

  test('PRNs Completed — business plan unlocked, sampling plan still locked', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ prns: { sectionStatus: 'Completed' } }),
      t
    )

    expect(vm.tasks[0].statusTagText).toBe('COMPLETED')
    expect(vm.tasks[0].locked).toBe(false)

    expect(vm.tasks[1].locked).toBe(false)
    expect(vm.tasks[1].url).toContain('/business-plan/')

    expect(vm.tasks[2].locked).toBe(true)
    expect(vm.tasks[2].url).toBeNull()

    expect(vm.allComplete).toBe(false)
  })

  test('PRNs + BusinessPlan Completed — sampling plan unlocked', () => {
    const vm = buildTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'Completed' },
        businessPlan: { sectionStatus: 'Completed' }
      }),
      t
    )

    expect(vm.tasks[1].locked).toBe(false)
    expect(vm.tasks[2].locked).toBe(false)
    expect(vm.tasks[2].url).toContain('/sampling-plan/')
    expect(vm.allComplete).toBe(false)
  })

  test('all sections Completed — allComplete true, continueUrl set', () => {
    const vm = buildTaskListViewModel(
      makeApplication({
        prns: { sectionStatus: 'Completed' },
        businessPlan: { sectionStatus: 'Completed' },
        samplingPlan: { sectionStatus: 'Completed' }
      }),
      t
    )

    expect(vm.allComplete).toBe(true)
    expect(vm.continueUrl).toContain('/submit-declaration/')
    expect(vm.tasks.every((task) => !task.locked)).toBe(true)
  })

  test('PRNs InProgress — tag shows IN PROGRESS with blue class', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ prns: { sectionStatus: 'InProgress' } }),
      t
    )

    expect(vm.tasks[0].statusTagText).toBe('IN PROGRESS')
    expect(vm.tasks[0].statusTagClass).toBe('govuk-tag--blue')
  })

  test('builds heading with material name', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.heading).toContain('Steel')
  })

  test('builds heading with glass recycling process suffix', () => {
    const vm = buildTaskListViewModel(
      makeApplication({
        materialType: 'Glass',
        glassRecyclingProcess: 'glass_re_melt'
      }),
      t
    )
    expect(vm.heading).toContain('Glass - glass_re_melt')
  })

  test('metadata contains year and site', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ year: 2026, siteAddress: '123 Test Street' }),
      t
    )
    expect(vm.metadata.year).toBe(2026)
    expect(vm.metadata.site).toBe('123 Test Street')
  })

  test('null siteId falls back to siteNotSet translation', () => {
    const vm = buildTaskListViewModel(makeApplication({ siteId: null }), t)
    expect(vm.metadata.site).toBe('siteNotSet')
  })

  test('null prns/businessPlan/samplingPlan treated as NotStarted', () => {
    const vm = buildTaskListViewModel(
      makeApplication({
        prns: null,
        businessPlan: null,
        samplingPlan: null
      }),
      t
    )
    expect(vm.allComplete).toBe(false)
    expect(vm.tasks[0].statusTagText).toBe('NOT STARTED')
  })

  test('task testId values are set correctly', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.tasks[0].testId).toBe('task-prns')
    expect(vm.tasks[1].testId).toBe('task-business-plan')
    expect(vm.tasks[2].testId).toBe('task-sampling-plan')
  })

  test('back link and save-and-come-back link point to /operator-accreditation', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.backLink).toBe(
      '/operator-accreditation/test-operator-id/site-abc/Steel/2026'
    )
    expect(vm.saveAndComeLaterLink).toBe('/operator')
  })

  test('reprocessor: isExporter flag is false', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.isExporter).toBe(false)
  })

  describe('exporter journey', () => {
    function makeExporterApp(overrides = {}) {
      return makeApplication({
        isExporter: true,
        siteId: null,
        materialType: 'Plastic',
        overseasSites: { sectionStatus: 'NotStarted' },
        besEvidence: { sectionStatus: 'NotStarted' },
        ...overrides
      })
    }

    test('builds 5 tasks', () => {
      const vm = buildTaskListViewModel(makeExporterApp(), t)
      expect(vm.tasks).toHaveLength(5)
    })

    test('overseas sites and BES locked when sampling plan not complete', () => {
      const vm = buildTaskListViewModel(makeExporterApp(), t)
      expect(vm.tasks[3].locked).toBe(true)
      expect(vm.tasks[3].url).toBeNull()
      expect(vm.tasks[4].locked).toBe(true)
      expect(vm.tasks[4].url).toBeNull()
    })

    test('overseas sites unlocked when sampling plan complete', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' }
        }),
        t
      )
      expect(vm.tasks[3].locked).toBe(false)
      expect(vm.tasks[3].url).toContain('/select-overseas-sites/')
      expect(vm.tasks[4].locked).toBe(true)
    })

    test('BES unlocked when overseas sites complete', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' },
          overseasSites: { sectionStatus: 'Completed' }
        }),
        t
      )
      expect(vm.tasks[3].locked).toBe(false)
      expect(vm.tasks[4].locked).toBe(false)
      expect(vm.tasks[4].url).toContain('/upload-evidence-for-overseas-site/')
    })

    test('allComplete requires all 5 sections', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' },
          overseasSites: { sectionStatus: 'Completed' },
          besEvidence: { sectionStatus: 'Completed' }
        }),
        t
      )
      expect(vm.allComplete).toBe(true)
      expect(vm.continueUrl).toContain('/submit-declaration/')
    })

    test('allComplete false when only 3 sections done', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' }
        }),
        t
      )
      expect(vm.allComplete).toBe(false)
      expect(vm.continueUrl).toBeNull()
    })

    test('backlink omits siteId', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({ year: CURRENT_YEAR }),
        t
      )
      expect(vm.backLink).toBe(
        `/operator-accreditation/test-operator-id/Plastic/${CURRENT_YEAR}`
      )
      expect(vm.backLink).not.toContain('null')
    })

    test('task[0] label uses perns key', () => {
      const vm = buildTaskListViewModel(makeExporterApp(), t)
      expect(vm.tasks[0].label).toBe('perns')
    })

    test('null overseasSites and besEvidence treated as NotStarted', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({ overseasSites: null, besEvidence: null }),
        t
      )
      expect(vm.tasks[3].statusTagText).toBe('NOT STARTED')
      expect(vm.tasks[4].statusTagText).toBe('NOT STARTED')
      expect(vm.allComplete).toBe(false)
    })

    test('isExporter flag set true in view model', () => {
      const vm = buildTaskListViewModel(makeExporterApp(), t)
      expect(vm.isExporter).toBe(true)
    })

    test('metadata.site is null for exporter', () => {
      const vm = buildTaskListViewModel(makeExporterApp(), t)
      expect(vm.metadata.site).toBeNull()
    })
  })
})

describe('#taskListGetController', () => {
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

  describe('GET /accreditation/task-list/{applicationId}', () => {
    test('returns 200 with heading containing material type', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        'Accredit to issue PRNs: UK Steel packaging waste'
      )
    })

    test('renders three task rows', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="task-prns"')
      expect(result).toContain('data-testid="task-business-plan"')
      expect(result).toContain('data-testid="task-sampling-plan"')
    })

    test('shows NOT STARTED tags when all sections NotStarted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('NOT STARTED')
      expect(result).toContain('govuk-tag--grey')
    })

    test('shows IN PROGRESS tag when PRNs section is InProgress', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { sectionStatus: 'InProgress' } })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('IN PROGRESS')
      expect(result).toContain('govuk-tag--blue')
    })

    test('shows COMPLETED tag with green class', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { sectionStatus: 'Completed' } })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('COMPLETED')
      expect(result).toContain('govuk-tag--green')
    })

    test('Continue button absent when not all sections complete', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="continue-button"')
    })

    test('Continue button present when all sections are Completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="continue-button"')
      expect(result).toContain(
        `/accreditation/submit-declaration/${APPLICATION_ID}`
      )
    })

    test('business plan row has no link when PRNs not complete (locked)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        `/accreditation/business-plan/${APPLICATION_ID}`
      )
    })

    test('business plan row has link when PRNs complete (unlocked)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ prns: { sectionStatus: 'Completed' } })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(`/accreditation/business-plan/${APPLICATION_ID}`)
    })

    test('renders save-and-come-back-later link to /operator-accreditation', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="save-come-back-link"')
      expect(result).toContain('href="/operator"')
    })

    test('renders back link to /operator-accreditation', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
    })

    test('renders year and site metadata', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ year: 2026, siteId: 'site-123' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="metadata-year"')
      expect(result).toContain('2026')
      expect(result).toContain('site-123')
    })

    test('returns 500 with error message when API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain(
        'Sorry, we were unable to load your accreditation task list. Please try again.'
      )
    })

    test('error response still renders back-link to /operator-accreditation', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain('href="/operator-accreditation"')
    })

    test('exporter: renders 5 task rows', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          siteId: null,
          materialType: 'Plastic',
          overseasSites: { sectionStatus: 'NotStarted' },
          besEvidence: { sectionStatus: 'NotStarted' }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="task-prns"')
      expect(result).toContain('data-testid="task-business-plan"')
      expect(result).toContain('data-testid="task-sampling-plan"')
      expect(result).toContain('data-testid="task-overseas-sites"')
      expect(result).toContain('data-testid="task-bes-evidence"')
    })

    test('exporter: heading contains PERNs', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          siteId: null,
          materialType: 'Plastic',
          overseasSites: { sectionStatus: 'NotStarted' },
          besEvidence: { sectionStatus: 'NotStarted' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Accredit to issue PERNs: UK')
    })

    test('exporter: all 5 sections complete shows Continue button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          siteId: null,
          materialType: 'Plastic',
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' },
          overseasSites: { sectionStatus: 'Completed' },
          besEvidence: { sectionStatus: 'Completed' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="continue-button"')
    })

    test('exporter: 3 sections complete does not show Continue button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          siteId: null,
          materialType: 'Plastic',
          prns: { sectionStatus: 'Completed' },
          businessPlan: { sectionStatus: 'Completed' },
          samplingPlan: { sectionStatus: 'Completed' },
          overseasSites: { sectionStatus: 'NotStarted' },
          besEvidence: { sectionStatus: 'NotStarted' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="continue-button"')
    })

    test('exporter: does not show site metadata row', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
          siteId: null,
          materialType: 'Plastic',
          overseasSites: { sectionStatus: 'NotStarted' },
          besEvidence: { sectionStatus: 'NotStarted' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="metadata-site"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Accreditation task list')
    })
  })
})
