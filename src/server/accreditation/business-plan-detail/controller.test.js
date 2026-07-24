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
import {
  validateDetailFields,
  buildTextareaInputs,
  DETAIL_FIELDS
} from './controller.js'

const APPLICATION_ID = 'app-bpd-001'

const t = (key) => {
  const last = key.split('.').pop()
  if (last === 'tooLong') return '{field} must be 500 characters or fewer'
  if (last === 'requiredWhenPercent') {
    return 'Enter a description when you have allocated a percentage to this category'
  }
  if (last === 'optional') return '(optional)'
  if (last === 'characterCountHint') return 'You can enter up to 500 characters'
  return last
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    registrationId: 'REG001',
    prns: { sectionStatus: 'Completed' },
    businessPlan: {
      newInfrastructurePercent: 20,
      priceSupportPercent: 20,
      businessCollectionsPercent: 20,
      communicationsPercent: 20,
      newMarketsPercent: 10,
      newUsesPercent: 10,
      newInfrastructureDetail: 'Investing in sorting lines',
      priceSupportDetail: '',
      businessCollectionsDetail: '',
      communicationsDetail: '',
      newMarketsDetail: '',
      newUsesDetail: '',
      sectionStatus: 'InProgress'
    },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#validateDetailFields', () => {
  test('returns no errors for all empty fields', () => {
    const errors = validateDetailFields({}, t)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  test('returns no errors for values within 500 chars', () => {
    const payload = { newInfrastructureDetail: 'a'.repeat(500) }
    const errors = validateDetailFields(payload, t)
    expect(errors.newInfrastructureDetail).toBeUndefined()
  })

  test('returns error for value exceeding 500 chars', () => {
    const payload = { newInfrastructureDetail: 'a'.repeat(501) }
    const errors = validateDetailFields(payload, t)
    expect(errors.newInfrastructureDetail).toBeDefined()
    expect(errors.newInfrastructureDetail.text).toContain('500 characters')
  })

  test('returns errors only for fields that exceed limit', () => {
    const payload = {
      newInfrastructureDetail: 'a'.repeat(501),
      priceSupportDetail: 'short text'
    }
    const errors = validateDetailFields(payload, t)
    expect(errors.newInfrastructureDetail).toBeDefined()
    expect(errors.priceSupportDetail).toBeUndefined()
  })

  test('returns error when percentage > 0 and detail is empty', () => {
    const application = makeApplication()
    const errors = validateDetailFields(
      { priceSupportDetail: '' },
      t,
      application
    )
    expect(errors.priceSupportDetail).toBeDefined()
    expect(errors.priceSupportDetail.text).toContain('allocated a percentage')
  })

  test('no error when percentage is 0 and detail is empty', () => {
    const application = makeApplication({
      businessPlan: {
        newInfrastructurePercent: 0,
        priceSupportPercent: 20,
        businessCollectionsPercent: 20,
        communicationsPercent: 20,
        newMarketsPercent: 20,
        newUsesPercent: 20,
        sectionStatus: 'InProgress'
      }
    })
    const errors = validateDetailFields(
      { newInfrastructureDetail: '' },
      t,
      application
    )
    expect(errors.newInfrastructureDetail).toBeUndefined()
  })

  test('no percentage check when application is null', () => {
    const errors = validateDetailFields(
      { newInfrastructureDetail: '' },
      t,
      null
    )
    expect(errors.newInfrastructureDetail).toBeUndefined()
  })
})

describe('#buildTextareaInputs', () => {
  test('returns one textarea per detail field', () => {
    const inputs = buildTextareaInputs({}, {}, t)
    expect(inputs).toHaveLength(DETAIL_FIELDS.length)
  })

  test('sets value from payload', () => {
    const inputs = buildTextareaInputs(
      { newInfrastructureDetail: 'some detail' },
      {},
      t
    )
    const field = inputs.find((i) => i.id === 'newInfrastructureDetail')
    expect(field.value).toBe('some detail')
  })

  test('sets errorMessage when error present', () => {
    const errors = {
      communicationsDetail: { text: 'too long error' }
    }
    const inputs = buildTextareaInputs({}, errors, t)
    const field = inputs.find((i) => i.id === 'communicationsDetail')
    expect(field.errorMessage).toEqual({ text: 'too long error' })
  })

  test('errorMessage is undefined when no error for field', () => {
    const inputs = buildTextareaInputs({}, {}, t)
    inputs.forEach((i) => expect(i.errorMessage).toBeUndefined())
  })

  test('label includes (optional) suffix', () => {
    const inputs = buildTextareaInputs({}, {}, t)
    inputs.forEach((i) => expect(i.label).toContain('(optional)'))
  })

  test('maxlength is 500', () => {
    const inputs = buildTextareaInputs({}, {}, t)
    inputs.forEach((i) => expect(i.maxlength).toBe(500))
  })
})

describe('#businessPlanDetailController', () => {
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

  describe('GET /accreditation/business-plan-detail/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders all six textarea inputs', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      DETAIL_FIELDS.forEach((field) => {
        expect(result).toContain(`data-testid="textarea-${field}"`)
      })
    })

    test('pre-populates textarea with existing detail values', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Investing in sorting lines')
    })

    test('back link points to business-plan page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/business-plan/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('shows PRN wording for a non-exporter application', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: false })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('PRN income')
      expect(result).not.toContain('PERN income')
    })

    test('shows PERN wording for an exporter application', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('PERN income')
      expect(result).not.toContain('PRN income')
    })

    test('returns 200 for Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('POST /accreditation/business-plan-detail/{applicationId} - save-and-continue', () => {
    test('patches all detail fields and redirects to business-plan-cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: 'Sorting lines investment',
          priceSupportDetail: 'Price support for collectors',
          businessCollectionsDetail: 'Expanding commercial collections',
          communicationsDetail: 'Public awareness campaigns',
          newMarketsDetail: 'Construction sector partnerships',
          newUsesDetail: 'Insulation manufacturing trials',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/business-plan-cya/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({
          newInfrastructureDetail: 'Sorting lines investment'
        })
      )
    })

    test('returns 400 with field error when textarea exceeds 500 chars', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: 'a'.repeat(501),
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain(
        'data-testid="field-error-newInfrastructureDetail"'
      )
    })

    test('shows PERN wording on the 400 re-render for an exporter application', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: 'a'.repeat(501),
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('PERN income')
    })

    test('submits with all fields empty when all percentages are zero', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          businessPlan: {
            newInfrastructurePercent: 0,
            priceSupportPercent: 0,
            businessCollectionsPercent: 0,
            communicationsPercent: 0,
            newMarketsPercent: 0,
            newUsesPercent: 0,
            sectionStatus: 'InProgress'
          }
        })
      )
      vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: '',
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('returns 400 when percentage > 0 but detail is empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: '',
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 500 service-problem page when PATCH fails with server error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          businessPlan: {
            newInfrastructurePercent: 0,
            priceSupportPercent: 0,
            businessCollectionsPercent: 0,
            communicationsPercent: 0,
            newMarketsPercent: 0,
            newUsesPercent: 0,
            sectionStatus: 'InProgress'
          }
        })
      )
      const err = Object.assign(new Error('save failed'), { status: 500 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: '',
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="try-again-link"')
    })
  })

  describe('POST /accreditation/business-plan-detail/{applicationId} - save-and-come-later', () => {
    test('patches and redirects to task list', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructureDetail: 'Some detail',
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledOnce()
    })
  })
})
