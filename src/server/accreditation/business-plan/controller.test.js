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
  parsePercent,
  validateBusinessPlanFields,
  buildFieldInputs,
  BUSINESS_PLAN_FIELDS
} from './controller.js'

const APPLICATION_ID = 'app-bp-001'

const t = (key) => {
  const last = key.split('.').pop()
  // Return placeholder-containing strings for validation messages
  if (last === 'wholeNumber') return 'Enter a whole number for {field}'
  if (last === 'outOfRange') return '{field} must be between 0 and 100'
  if (last === 'mustSumTo100') return 'The percentages must add up to 100'
  return last
}

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2025,
    siteId: 'site-001',
    prns: { sectionStatus: 'Completed' },
    businessPlan: {
      newInfrastructurePercent: 20,
      priceSupportPercent: 20,
      businessCollectionsPercent: 20,
      communicationsPercent: 20,
      newMarketsPercent: 10,
      newUsesPercent: 10,
      sectionStatus: 'InProgress'
    },
    samplingPlan: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

function validPayload() {
  return {
    newInfrastructurePercent: '20',
    priceSupportPercent: '20',
    businessCollectionsPercent: '20',
    communicationsPercent: '20',
    newMarketsPercent: '10',
    newUsesPercent: '10'
  }
}

describe('#parsePercent', () => {
  test('returns 0 for empty string', () => {
    expect(parsePercent('')).toBe(0)
  })

  test('returns null for null', () => {
    expect(parsePercent(null)).toBeNull()
  })

  test('returns null for undefined', () => {
    expect(parsePercent(undefined)).toBeNull()
  })

  test('returns NaN for non-numeric string', () => {
    expect(parsePercent('abc')).toBeNaN()
  })

  test('returns NaN for decimal string', () => {
    expect(parsePercent('1.5')).toBeNaN()
  })

  test('returns integer for valid string', () => {
    expect(parsePercent('50')).toBe(50)
  })

  test('returns 0 for "0"', () => {
    expect(parsePercent('0')).toBe(0)
  })

  test('returns 100 for "100"', () => {
    expect(parsePercent('100')).toBe(100)
  })
})

describe('#validateBusinessPlanFields', () => {
  test('returns no errors for valid payload summing to 100', () => {
    const { errors, values } = validateBusinessPlanFields(validPayload(), t)
    expect(Object.keys(errors)).toHaveLength(0)
    expect(values.newInfrastructurePercent).toBe(20)
  })

  test('returns _sum error when percentages do not total 100', () => {
    const payload = { ...validPayload(), newInfrastructurePercent: '10' }
    const { errors } = validateBusinessPlanFields(payload, t)
    expect(errors._sum).toBeDefined()
    expect(errors._sum.text).toContain('100')
  })

  test('returns field error for non-numeric input', () => {
    const payload = { ...validPayload(), newMarketsPercent: 'abc' }
    const { errors } = validateBusinessPlanFields(payload, t)
    expect(errors.newMarketsPercent).toBeDefined()
    expect(errors.newMarketsPercent.text).toContain('whole number')
  })

  test('returns field error for decimal input', () => {
    const payload = { ...validPayload(), newMarketsPercent: '5.5' }
    const { errors } = validateBusinessPlanFields(payload, t)
    expect(errors.newMarketsPercent).toBeDefined()
  })

  test('returns field error for value over 100', () => {
    const payload = { ...validPayload(), newMarketsPercent: '101' }
    const { errors } = validateBusinessPlanFields(payload, t)
    expect(errors.newMarketsPercent.text).toContain('between 0 and 100')
  })

  test('empty field treated as 0, triggers sum error when save-and-continue', () => {
    const payload = { ...validPayload(), newMarketsPercent: '' }
    const { errors } = validateBusinessPlanFields(payload, t, false)
    expect(errors.newMarketsPercent).toBeUndefined()
    expect(errors._sum).toBeDefined()
  })

  test('no error for empty field when skipSumCheck (save-and-come-later)', () => {
    const payload = {
      newInfrastructurePercent: '50',
      priceSupportPercent: '',
      businessCollectionsPercent: '',
      communicationsPercent: '',
      newMarketsPercent: '',
      newUsesPercent: ''
    }
    const { errors } = validateBusinessPlanFields(payload, t, true)
    expect(errors.priceSupportPercent).toBeUndefined()
    expect(errors._sum).toBeUndefined()
  })

  test('still errors on non-numeric even when skipSumCheck', () => {
    const payload = { ...validPayload(), communicationsPercent: 'xyz' }
    const { errors } = validateBusinessPlanFields(payload, t, true)
    expect(errors.communicationsPercent).toBeDefined()
  })
})

describe('#buildFieldInputs', () => {
  test('returns one input per business plan field', () => {
    const inputs = buildFieldInputs({}, {}, t)
    expect(inputs).toHaveLength(BUSINESS_PLAN_FIELDS.length)
  })

  test('sets value from payload', () => {
    const inputs = buildFieldInputs({ newInfrastructurePercent: '30' }, {}, t)
    const field = inputs.find((i) => i.id === 'newInfrastructurePercent')
    expect(field.value).toBe('30')
  })

  test('sets errorMessage when error present', () => {
    const errors = { newInfrastructurePercent: { text: 'some error' } }
    const inputs = buildFieldInputs({}, errors, t)
    const field = inputs.find((i) => i.id === 'newInfrastructurePercent')
    expect(field.errorMessage).toEqual({ text: 'some error' })
  })

  test('errorMessage is undefined when no error', () => {
    const inputs = buildFieldInputs({}, {}, t)
    inputs.forEach((i) => expect(i.errorMessage).toBeUndefined())
  })
})

describe('#businessPlanController', () => {
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

  describe('GET /accreditation/business-plan/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders all six field inputs', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      BUSINESS_PLAN_FIELDS.forEach((field) => {
        expect(result).toContain(`data-testid="input-${field}"`)
      })
    })

    test('pre-populates fields from API response', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('value="20"')
    })

    test('renders empty inputs when BusinessPlan fields are undefined', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ BusinessPlan: { SectionStatus: 'NotStarted' } })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('value=""')
    })

    test('back link points to task list hub', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/task-list/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 for Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('exporter GET shows PERN intro text', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('PERN income')
      expect(result).not.toContain('PRN income')
    })
  })

  describe('POST /accreditation/business-plan/{applicationId} - save-and-continue', () => {
    test('returns 500 when application GET fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 400 with error summary when all fields are empty', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 400 when percentages do not sum to 100', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          ...validPayload(),
          newInfrastructurePercent: '10',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 400 with field error for non-numeric input', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          ...validPayload(),
          newMarketsPercent: 'abc',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="field-error-newMarketsPercent"')
    })

    test('exporter POST validation error shows PERN intro text', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('PERN income')
      expect(result).not.toContain('PRN income')
    })

    test('patches and redirects to business-plan-detail on valid save-and-continue', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/business-plan-detail/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              category: 'newInfrastructure',
              percentSpent: 20
            })
          ])
        })
      )
    })

    test('returns 500 service-problem page when PATCH fails with server error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('save failed'), { status: 500 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="try-again-link"')
    })
  })

  describe('POST /accreditation/business-plan/{applicationId} - save-and-come-later', () => {
    test('patches partial data and redirects to task list without sum-to-100 error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructurePercent: '50',
          priceSupportPercent: '',
          businessCollectionsPercent: '',
          communicationsPercent: '',
          newMarketsPercent: '',
          newUsesPercent: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledOnce()
    })

    test('returns 400 when non-numeric value present even on save-and-come-later', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: {
          newInfrastructurePercent: 'abc',
          priceSupportPercent: '',
          businessCollectionsPercent: '',
          communicationsPercent: '',
          newMarketsPercent: '',
          newUsesPercent: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
