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
  if (last === 'wholeNumber') {
    return 'Enter a whole number for {field}'
  }
  if (last === 'outOfRange') {
    return '{field} must be between 0 and 100'
  }
  if (last === 'mustSumTo100') {
    return 'The percentages must add up to 100'
  }
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
      otherPercent: 0,
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
    newUsesPercent: '10',
    otherPercent: '0'
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

  test('accepts a non-zero otherPercent as part of a valid 100% total', () => {
    const payload = {
      ...validPayload(),
      newInfrastructurePercent: '15',
      otherPercent: '5'
    }
    const { errors, values } = validateBusinessPlanFields(payload, t)
    expect(Object.keys(errors)).toHaveLength(0)
    expect(values.otherPercent).toBe(5)
  })

  test('returns field error for non-numeric otherPercent input', () => {
    const payload = { ...validPayload(), otherPercent: 'abc' }
    const { errors } = validateBusinessPlanFields(payload, t)
    expect(errors.otherPercent).toBeDefined()
    expect(errors.otherPercent.text).toContain('whole number')
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

    test('renders all seven field inputs, including the "other" category', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(BUSINESS_PLAN_FIELDS).toContain('otherPercent')
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

    test('shows the regulator plan reminder text', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        'The regulator will expect you to follow this plan.'
      )
    })

    test('shows the whole-percentage hint on each field', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      const matches =
        result.match(/Enter the percentage as a whole number/g) ?? []
      expect(matches).toHaveLength(BUSINESS_PLAN_FIELDS.length)
    })

    test('shows the Welsh whole-percentage hint in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('[Welsh] Enter the percentage as a whole number')
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

    test('redirects to query-task-list when application is Queried and business plan section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'NotStarted' }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test('renders the form read-only when application is Queried and business plan section is Completed', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'Completed' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="read-only-notice"')
      expect(result).not.toContain('data-testid="continue-button"')
      expect(result).not.toContain('data-testid="save-come-back-button"')
      expect(result).toContain(
        `href="/accreditation/query-task-list/${APPLICATION_ID}"`
      )
    })

    // RA-481: a locked (submitted) application must still render on GET —
    // it just renders read-only, unlike the fully-blocked NotStarted/
    // InProgress case in the Queried flow above.
    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders the form read-only (200, not a redirect) when application is locked (%s) and business plan section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            businessPlan: { sectionStatus: 'Completed' }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/business-plan/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
        expect(result).not.toContain('data-testid="continue-button"')
        expect(result).not.toContain('data-testid="save-come-back-button"')
        // Unlike the Queried-flow case, the back link goes to the ordinary
        // task list (also read-only), not the query task list.
        expect(result).toContain(
          `href="/accreditation/task-list/${APPLICATION_ID}"`
        )
      }
    )

    // RA-481: the plain-submitted read-only notice is distinct copy from the
    // regulator-query one — it must not mention the query task list.
    test('shows the plain-submitted read-only copy (not the query-flow copy) when locked and not queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Submitted',
          businessPlan: { sectionStatus: 'Completed' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        'This application has already been submitted, so this section is now read-only.'
      )
      expect(result).not.toContain("is not part of the regulator's query")
    })

    test('renders the form editable when the application is locked but the business plan section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Updated',
          businessPlan: { sectionStatus: 'Queried' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('data-testid="read-only-notice"')
      expect(result).toContain('data-testid="continue-button"')
    })

    test('does not render the regulator-query banner for a read-only section, even though another section is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'Completed' },
          prns: { sectionStatus: 'Queried' },
          query: { queryNote: 'Please confirm the planned tonnage band.' }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="regulator-query-banner"')
      expect(result).not.toContain('Please confirm the planned tonnage band.')
      expect(result).not.toContain(
        'The regulator has identified an issue with your business plan.'
      )
    })

    test('renders the form and query note when business plan section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'Queried' },
          query: { queryNote: 'Please break down the price support spend.' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Please break down the price support spend.')
    })

    test('hides the regulator-query banner when REGULATOR_QUERY_TEXT_DISABLED is true', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'Queried' },
          query: { queryNote: 'Please break down the price support spend.' }
        })
      )
      const originalConfigGet = config.get.bind(config)
      const configSpy = vi
        .spyOn(config, 'get')
        .mockImplementation((key) =>
          key === 'regulatorQuery.textDisabled' ? true : originalConfigGet(key)
        )

      try {
        const { result } = await server.inject({
          method: 'GET',
          url: `/accreditation/business-plan/${APPLICATION_ID}`,
          headers: operatorHeaders
        })

        expect(result).not.toContain('data-testid="regulator-query-banner"')
        expect(result).not.toContain(
          'Please break down the price support spend.'
        )
      } finally {
        configSpy.mockRestore()
      }
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

    test('redirects to query-task-list when application is Queried and business plan section has not been started, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'NotStarted' }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 400 with inline save error when PATCH fails with a non-server, non-conflict status', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('bad request'), { status: 422 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
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

    test('redirects to query-task-list when application is Queried and business plan section is not, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: { sectionStatus: 'Completed' }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    // RA-481: once submitted, a save to a non-queried section must be
    // refused server-side, redirecting back to this same page (which then
    // re-fetches and renders read-only) rather than processing the write.
    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page when application is locked (%s) and business plan section is not Queried, without patching',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            businessPlan: { sectionStatus: 'Completed' }
          })
        )
        const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/business-plan/${APPLICATION_ID}`,
          headers: operatorHeaders,
          payload: { ...validPayload(), submitAction: 'saveAndContinue' }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/business-plan/${APPLICATION_ID}`
        )
        expect(patchSpy).not.toHaveBeenCalled()
      }
    )

    test('allows the save when the application is locked but the business plan section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Updated',
          businessPlan: { sectionStatus: 'Queried' }
        })
      )
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
      expect(patchSpy).toHaveBeenCalled()
    })

    test('redirects back to this page (not the raw error page) when the PATCH fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { ...validPayload(), submitAction: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/business-plan/${APPLICATION_ID}`
      )
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
          isPartialSave: true,
          newInfrastructurePercent: 20
        })
      )
      expect(patchSpy.mock.calls[0][1].sectionStatus).toBeUndefined()
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
          otherPercent: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({ sectionStatus: 'InProgress' })
      )
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
          otherPercent: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
