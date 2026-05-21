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
import { buildTonnageOptions, TONNAGE_OPTIONS } from './controller.js'

const APPLICATION_ID = 'app-prns-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    isExporter: false,
    prns: {
      plannedTonnageBand: null,
      authorisers: [],
      sectionStatus: 'NotStarted'
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildTonnageOptions', () => {
  test('returns all 4 options', () => {
    const options = buildTonnageOptions(null, t)
    expect(options).toHaveLength(4)
    expect(options.map((o) => o.value)).toEqual(TONNAGE_OPTIONS)
  })

  test('no option is checked when selectedTonnage is null', () => {
    const options = buildTonnageOptions(null, t)
    expect(options.every((o) => !o.checked)).toBe(true)
  })

  test('UpTo500 is checked when selected', () => {
    const options = buildTonnageOptions('UpTo500', t)
    const checked = options.filter((o) => o.checked)
    expect(checked).toHaveLength(1)
    expect(checked[0].value).toBe('UpTo500')
  })

  test('Over10000 is checked when selected', () => {
    const options = buildTonnageOptions('Over10000', t)
    expect(options.find((o) => o.value === 'Over10000').checked).toBe(true)
  })

  test('each option text is derived from translation key', () => {
    const options = buildTonnageOptions(null, t)
    options.forEach((o) => {
      expect(o.text).toBe(o.value)
    })
  })
})

describe('#tonnageController', () => {
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

  describe('GET /accreditation/tonnage/{applicationId}', () => {
    test('returns 200 with heading containing the material type', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Steel')
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders four radio options', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="tonnage-radios"')
      TONNAGE_OPTIONS.forEach((value) => {
        expect(result).toContain(
          `data-testid="tonnage-option-${value.toLowerCase()}"`
        )
      })
    })

    test('pre-populates radio when application has existing PlannedTonnageBand', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo1000',
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toMatch(/value="UpTo1000"[\s\S]*?checked/)
    })

    test('no radio pre-selected when PlannedTonnageBand is null', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toMatch(
        /value="(UpTo500|UpTo1000|UpTo10000|Over10000)"[\s\S]*?checked/
      )
    })

    test('back link points to the task list hub', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/task-list/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error message when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] How many PRNs do you plan to issue?')
    })

    test('exporter sees PERNs heading suffix', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('PERNs do you plan to issue?')
    })
  })

  describe('GET task list hub — links to tonnage page', () => {
    test('task list renders a link to the tonnage page for the PRNs task', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/task-list/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        `href="/accreditation/tonnage/${APPLICATION_ID}"`
      )
      expect(result).toContain('data-testid="task-prns-link"')
    })
  })

  describe('POST /accreditation/tonnage/{applicationId}', () => {
    test('returns 400 with validation error when no selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select how many PRNs you plan to issue')
    })

    test('exporter gets PERN validation message when no selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select how many PERNs you plan to issue')
    })

    test('returns 400 with validation error when invalid value submitted', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'InvalidValue',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('save-and-continue patches tonnage and redirects to tonnage-authority', async () => {
      const getSpy = vi
        .spyOn(apiClient, 'get')
        .mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'UpTo1000',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/tonnage-authority/${APPLICATION_ID}`
      )
      expect(getSpy).toHaveBeenCalledOnce()
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/tonnage`),
        { plannedTonnageBand: 'UpTo1000' }
      )
    })

    test('save-and-come-back-later patches tonnage and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'UpTo500',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledOnce()
    })

    test('returns 500 with error when GET fetch fails on POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'UpTo500',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 500 with error when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('Save failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'UpTo500',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('PATCH error re-renders with previously selected radio', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('Save failed'))

      const { result } = await server.inject({
        method: 'POST',
        url: `/accreditation/tonnage/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          plannedTonnageBand: 'Over10000',
          submitAction: 'saveAndContinue'
        }
      })

      expect(result).toContain('value="Over10000"')
    })
  })
})
