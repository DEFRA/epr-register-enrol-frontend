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
import { buildSummaryRows } from './controller.js'

const APPLICATION_ID = 'app-bpcya-001'

const t = (key) => {
  const last = key.split('.').pop()
  if (last === 'notProvided') return 'Not provided'
  if (last === 'changePercentContext') return 'percentage for {field}'
  if (last === 'changeDetailContext') return 'detail for {field}'
  return last
}

function makeApplication(overrides = {}) {
  return {
    ApplicationId: APPLICATION_ID,
    OrganisationId: 'test-operator-id',
    MaterialType: 'Steel',
    Year: 2025,
    SiteId: 'site-001',
    Prns: { SectionStatus: 'Completed' },
    BusinessPlan: {
      NewInfrastructurePercent: 40,
      PriceSupportPercent: 20,
      BusinessCollectionsPercent: 15,
      CommunicationsPercent: 10,
      NewMarketsPercent: 10,
      NewUsesPercent: 5,
      NewInfrastructureDetail: 'Investing in sorting lines',
      PriceSupportDetail: '',
      BusinessCollectionsDetail: '',
      CommunicationsDetail: '',
      NewMarketsDetail: '',
      NewUsesDetail: '',
      SectionStatus: 'InProgress'
    },
    SamplingPlan: { SectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildSummaryRows', () => {
  test('returns 6 percent rows and 6 detail rows', () => {
    const { percentRows, detailRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    expect(percentRows).toHaveLength(6)
    expect(detailRows).toHaveLength(6)
  })

  test('percent row value includes % suffix', () => {
    const { percentRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    const row = percentRows.find((r) => r.id === 'newInfrastructurePercent')
    expect(row.value).toBe('40%')
  })

  test('shows "Not provided" when percent value is undefined', () => {
    const application = makeApplication({
      BusinessPlan: {
        NewMarketsPercent: undefined,
        SectionStatus: 'InProgress'
      }
    })
    const { percentRows } = buildSummaryRows(application, t, APPLICATION_ID)
    const row = percentRows.find((r) => r.id === 'newMarketsPercent')
    expect(row.value).toBe('Not provided')
  })

  test('detail row shows "Not provided" when value is empty', () => {
    const { detailRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    const row = detailRows.find((r) => r.id === 'priceSupportDetail')
    expect(row.value).toBe('Not provided')
  })

  test('detail row shows actual value when provided', () => {
    const { detailRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    const row = detailRows.find((r) => r.id === 'newInfrastructureDetail')
    expect(row.value).toBe('Investing in sorting lines')
  })

  test('percent change links include fromCYA param pointing to business-plan', () => {
    const { percentRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    percentRows.forEach((row) => {
      expect(row.changeLink).toContain('/accreditation/business-plan/')
      expect(row.changeLink).toContain('?fromCYA=true')
    })
  })

  test('detail change links include fromCYA param pointing to business-plan-detail', () => {
    const { detailRows } = buildSummaryRows(
      makeApplication(),
      t,
      APPLICATION_ID
    )
    detailRows.forEach((row) => {
      expect(row.changeLink).toContain('/accreditation/business-plan-detail/')
      expect(row.changeLink).toContain('?fromCYA=true')
    })
  })
})

describe('#businessPlanCyaController', () => {
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

  describe('GET /accreditation/business-plan-cya/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders summary list with percent rows', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="percent-summary-list"')
      expect(result).toContain(
        'data-testid="percent-row-newInfrastructurePercent"'
      )
    })

    test('displays percentage value in summary', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        'data-testid="percent-value-newInfrastructurePercent"'
      )
      expect(result).toContain('40%')
    })

    test('shows "Not provided" for empty detail', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Not provided')
    })

    test('shows pre-populated detail value', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Investing in sorting lines')
    })

    test('change links include fromCYA param', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('?fromCYA=true')
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/business-plan-cya/{applicationId} - confirm', () => {
    test('PATCHes application with Completed status and redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({ NewInfrastructurePercent: 40 })
      )
    })

    test('returns 500 with inline error when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('save failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 500 when GET fetch fails during confirm', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/business-plan-cya/{applicationId} - saveAndComeLater', () => {
    test('redirects to task list without calling PATCH', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })
  })
})
