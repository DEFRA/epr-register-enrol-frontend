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
import { buildTonnageLabel, buildAuthorisersSummary } from './controller.js'

const APPLICATION_ID = 'app-cya-001'

const t = (key) => key.split('.').pop()

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    prns: {
      plannedTonnageBand: 'UpTo1000',
      authorisers: [{ fullName: 'Jane Smith', email: 'jane@example.com' }],
      sectionStatus: 'InProgress'
    },
    businessPlan: { sectionStatus: 'NotStarted' },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#buildTonnageLabel', () => {
  test('returns translation key text for valid band', () => {
    expect(buildTonnageLabel('UpTo500', t)).toBe('UpTo500')
    expect(buildTonnageLabel('Over10000', t)).toBe('Over10000')
  })

  test('returns notSelected fallback for null', () => {
    expect(buildTonnageLabel(null, t)).toBe('notSelected')
  })

  test('returns notSelected fallback for unknown band', () => {
    expect(buildTonnageLabel('Unknown', t)).toBe('notSelected')
  })
})

describe('#buildAuthorisersSummary', () => {
  test('returns noneSelected for empty array', () => {
    expect(buildAuthorisersSummary([], t)).toBe('noneSelected')
  })

  test('returns noneSelected for null', () => {
    expect(buildAuthorisersSummary(null, t)).toBe('noneSelected')
  })

  test('returns single name', () => {
    expect(
      buildAuthorisersSummary(
        [{ fullName: 'Jane Smith', email: 'jane@example.com' }],
        t
      )
    ).toBe('Jane Smith')
  })

  test('returns comma-separated names for multiple authorisers', () => {
    const result = buildAuthorisersSummary(
      [
        { fullName: 'Jane Smith', email: 'j@example.com' },
        { fullName: 'Bob Jones', email: 'b@example.com' }
      ],
      t
    )
    expect(result).toContain('Jane Smith')
    expect(result).toContain('Bob Jones')
  })
})

describe('#prnsCyaController', () => {
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

  describe('GET /accreditation/prns-cya/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders summary list with tonnage and authorisers rows', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="summary-list"')
      expect(result).toContain('data-testid="tonnage-row"')
      expect(result).toContain('data-testid="authorisers-row"')
    })

    test('shows tonnage band value in summary', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="tonnage-value"')
    })

    test('shows authorisers value in summary', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Jane Smith')
    })

    test('shows none selected when no authorisers', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          prns: {
            plannedTonnageBand: 'UpTo500',
            authorisers: [],
            sectionStatus: 'InProgress'
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="authorisers-value"')
    })

    test('renders change links with fromCYA param', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="change-tonnage-link"')
      expect(result).toContain('?fromCYA=true')
      expect(result).toContain('data-testid="change-authority-link"')
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('network error'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/prns-cya/{applicationId} - confirm', () => {
    test('PATCHes application and redirects to task list on confirm', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/prns'),
        expect.objectContaining({
          plannedTonnageBand: 'UpTo1000',
          authorisers: expect.arrayContaining([
            expect.objectContaining({ fullName: 'Jane Smith' })
          ])
        })
      )
    })

    test('returns 500 with inline error when PATCH fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('save failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'confirm' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/prns-cya/{applicationId} - saveAndComeLater', () => {
    test('redirects to task list without calling PATCH', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch')

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/prns-cya/${APPLICATION_ID}`,
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
