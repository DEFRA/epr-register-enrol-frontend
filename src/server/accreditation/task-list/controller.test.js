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
import { buildTaskListViewModel } from './controller.js'

const APPLICATION_ID = 'app-steel-001'
const CURRENT_YEAR = new Date().getFullYear()

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    registrationId: 'reg-abc',
    materialType: 'Steel',
    year: CURRENT_YEAR,
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

  test('applicationStatus Submitted — isSubmitted true', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ applicationStatus: 'Submitted' }),
      t
    )

    expect(vm.isSubmitted).toBe(true)
  })

  test('applicationStatus Saved — isSubmitted false', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ applicationStatus: 'Saved' }),
      t
    )

    expect(vm.isSubmitted).toBe(false)
  })

  test('applicationStatus Updated — isSubmitted true', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ applicationStatus: 'Updated' }),
      t
    )

    expect(vm.isSubmitted).toBe(true)
  })

  test('applicationStatus DulyMade — isSubmitted true', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ applicationStatus: 'DulyMade' }),
      t
    )

    expect(vm.isSubmitted).toBe(true)
  })

  test('applicationStatus AwaitingDecision — isSubmitted true', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ applicationStatus: 'AwaitingDecision' }),
      t
    )

    expect(vm.isSubmitted).toBe(true)
  })

  test('viewPaymentDetailsLink contains applicationId', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)

    expect(vm.viewPaymentDetailsLink).toBe(
      `/accreditation/view-payment-details/${APPLICATION_ID}`
    )
  })

  test('PRNs InProgress — tag shows IN PROGRESS with blue class', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ prns: { sectionStatus: 'InProgress' } }),
      t
    )

    expect(vm.tasks[0].statusTagText).toBe('IN PROGRESS')
    expect(vm.tasks[0].statusTagClass).toBe('govuk-tag--blue')
  })

  test('PRNs Submitted — tag shows SUBMITTED with green class', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ prns: { sectionStatus: 'Submitted' } }),
      t
    )

    expect(vm.tasks[0].statusTagText).toBe('SUBMITTED')
    expect(vm.tasks[0].statusTagClass).toBe('govuk-tag--green')
  })

  test('PRNs Queried — tag shows QUERIED with orange class', () => {
    const vm = buildTaskListViewModel(
      makeApplication({ prns: { sectionStatus: 'Queried' } }),
      t
    )

    expect(vm.tasks[0].statusTagText).toBe('QUERIED')
    expect(vm.tasks[0].statusTagClass).toBe('govuk-tag--orange')
  })

  // Site/material/operator are no longer duplicated on this page's own
  // heading or metadata — they're shown once, in the persistent
  // application-header (see src/server/common/helpers/applicationHeader.js),
  // so the heading here is just the static "reapply" prompt.
  test('heading is the reapply prompt, not tied to material', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.heading).toBe('headingPrefix')
  })

  test('exporter heading uses the exporter-specific prefix', () => {
    const vm = buildTaskListViewModel(makeApplication({ isExporter: true }), t)
    expect(vm.heading).toBe('headingPrefixExporter')
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

  test('back link points to /operator-accreditation', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.backLink).toBe(
      `/operator-accreditation/test-operator-id/reg-abc/Steel/${CURRENT_YEAR}`
    )
  })

  // RA-459: /operator is a test-only page — the "save and come back later"
  // link always points at the real Re-Ex frontend instead, regardless of
  // TEST_PAGES_DISABLED, so it never dead-ends there. Both values exercised,
  // not just the default, to actually prove the decoupling.
  test.each([true, false])(
    'save-and-come-back link points to the Re-Ex frontend when testPages.disabled is %s',
    (testPagesDisabled) => {
      const realConfigGet = config.get.bind(config)
      const spy = vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'reex.frontendBaseUrl') {
          return 'https://reex.example'
        }
        if (key === 'testPages.disabled') {
          return testPagesDisabled
        }
        return realConfigGet(key)
      })

      const vm = buildTaskListViewModel(makeApplication(), t)
      expect(vm.saveAndComeLaterLink).toBe('https://reex.example')

      spy.mockRestore()
    }
  )

  test('reprocessor: isExporter flag is false', () => {
    const vm = buildTaskListViewModel(makeApplication(), t)
    expect(vm.isExporter).toBe(false)
  })

  describe('exporter journey', () => {
    function makeExporterApp(overrides = {}) {
      return makeApplication({
        isExporter: true,
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

    test('backlink is the single unified route, same shape as the reprocessor journey (RA-374)', () => {
      const vm = buildTaskListViewModel(
        makeExporterApp({ year: CURRENT_YEAR }),
        t
      )
      expect(vm.backLink).toBe(
        `/operator-accreditation/test-operator-id/reg-abc/Plastic/${CURRENT_YEAR}`
      )
      expect(vm.backLink).not.toContain('null')
      expect(vm.backLink).not.toContain('undefined')
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
  })
})

describe('#taskListGetController', () => {
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

  describe('GET /accreditation/task-list/{applicationId}', () => {
    test('returns 200 with the reapply heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Reapply for accreditation')
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

    test('Continue button and save-and-come-later link hidden when application is Submitted, even with all sections complete', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
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

      expect(result).not.toContain('data-testid="continue-button"')
      expect(result).not.toContain('data-testid="save-come-back-link"')
    })

    test('submitted text and view-payment-details link shown when application is Submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Submitted' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        'This reapplication for accreditation has been submitted'
      )
      expect(result).toContain('data-testid="view-payment-details-link"')
      expect(result).toContain(
        `/accreditation/view-payment-details/${APPLICATION_ID}`
      )
    })

    test('submitted text and view-payment-details link NOT shown when application is not yet Submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Saved' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain(
        'This reapplication for accreditation has been submitted'
      )
      expect(result).not.toContain('data-testid="view-payment-details-link"')
    })

    test('save-and-come-later link shown when application is not yet Submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Saved' })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="save-come-back-link"')
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

    test('renders save-and-come-back-later link to the Re-Ex frontend', async () => {
      const realConfigGet = config.get.bind(config)
      const spy = vi.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'reex.frontendBaseUrl') {
          return 'https://reex.example'
        }
        return realConfigGet(key)
      })

      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="save-come-back-link"')
      expect(result).toContain('href="https://reex.example"')

      spy.mockRestore()
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

    test('exporter: renders the exporter-specific reapply heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
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

      expect(result).toContain('Reapply for accreditation')
    })

    test('exporter: all 5 sections complete shows Continue button', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          isExporter: true,
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

    test('redirects to query-task-list when applicationStatus is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ applicationStatus: 'Queried' })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test.each(['Approved', 'Rejected', 'Withdrawn'])(
      'redirects to the landing page when applicationStatus is %s',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({ applicationStatus })
        )

        const { statusCode, headers } = await server.inject({
          method: 'GET',
          url: `/accreditation/task-list/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/operator-accreditation/test-operator-id/reg-abc/Steel/${CURRENT_YEAR}`
        )
      }
    )
  })
})
