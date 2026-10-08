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
import {
  validateDetailFields,
  buildTextareaInputs,
  DETAIL_FIELDS
} from './controller.js'

const APPLICATION_ID = 'app-bpd-001'

const t = (key) => {
  const last = key.split('.').pop()
  if (last === 'tooLong') {
    return '{field} must be 500 characters or fewer'
  }
  if (last === 'requiredWhenPercent') {
    return 'Enter a description when you have allocated a percentage to this category'
  }
  if (last === 'optional') {
    return '(optional)'
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
      newInfrastructurePercent: 15,
      priceSupportPercent: 20,
      businessCollectionsPercent: 20,
      communicationsPercent: 20,
      newMarketsPercent: 10,
      newUsesPercent: 10,
      otherPercent: 5,
      newInfrastructureDetail: 'Investing in sorting lines',
      priceSupportDetail: '',
      businessCollectionsDetail: '',
      communicationsDetail: '',
      newMarketsDetail: '',
      newUsesDetail: '',
      otherDetail: '',
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

  test('returns error when otherPercent > 0 and otherDetail is empty', () => {
    const application = makeApplication()
    const errors = validateDetailFields({ otherDetail: '' }, t, application)
    expect(errors.otherDetail).toBeDefined()
    expect(errors.otherDetail.text).toContain('allocated a percentage')
  })

  test('returns error for otherDetail exceeding 500 chars', () => {
    const payload = { otherDetail: 'a'.repeat(501) }
    const errors = validateDetailFields(payload, t)
    expect(errors.otherDetail).toBeDefined()
    expect(errors.otherDetail.text).toContain('500 characters')
  })

  // RA-268. A native <textarea maxlength="500"> counts a line break as one
  // "\n" character — that's what stopped the operator typing any further —
  // but HTML forms normalise every line break in a textarea's value to CRLF
  // ("\r\n") when the browser builds the submitted request body. A value
  // that was exactly 500 characters as the operator typed it therefore
  // arrives here longer by one extra character per line break, so a raw
  // `.length` check rejected text the operator was never able to exceed.
  test('does not inflate the count from CRLF line breaks a browser submits', () => {
    const line = 'x'.repeat(30) + '\n' // 31 chars as the browser (and its maxlength) counts it
    let value = ''
    while (value.length + line.length <= 500) {
      value += line
    }
    value += 'x'.repeat(500 - value.length)
    expect(value).toHaveLength(500)

    // What the server actually receives once the browser CRLF-normalises
    // those line breaks for submission.
    const submitted = value.replace(/\n/g, '\r\n')
    expect(submitted.length).toBeGreaterThan(500)

    const errors = validateDetailFields(
      { newInfrastructureDetail: submitted },
      t
    )
    expect(errors.newInfrastructureDetail).toBeUndefined()
  })

  test('a genuinely too-long value is still rejected once CRLF is normalised away', () => {
    const submitted = ('x'.repeat(30) + '\r\n').repeat(20) // well over 500 either way
    const errors = validateDetailFields(
      { newInfrastructureDetail: submitted },
      t
    )
    expect(errors.newInfrastructureDetail).toBeDefined()
  })
})

describe('#buildTextareaInputs', () => {
  test('falls back to showing every field when application is not provided', () => {
    const inputs = buildTextareaInputs({}, {}, t)
    expect(inputs).toHaveLength(DETAIL_FIELDS.length)
  })

  test('preserves submitted payload values when application is not provided', () => {
    const inputs = buildTextareaInputs(
      { newInfrastructureDetail: 'a'.repeat(501) },
      {
        newInfrastructureDetail: {
          text: 'newInfrastructureDetail must be 500 characters or fewer'
        }
      },
      t
    )
    const field = inputs.find((i) => i.id === 'newInfrastructureDetail')
    expect(field.value).toBe('a'.repeat(501))
    expect(field.errorMessage.text).toContain('500 characters')
  })

  test('returns a textarea for every field when all percentages are set', () => {
    const inputs = buildTextareaInputs({}, {}, t, makeApplication())
    expect(inputs).toHaveLength(DETAIL_FIELDS.length)
  })

  test('hides fields whose percentage is 0 or not set', () => {
    const application = makeApplication({
      businessPlan: {
        newInfrastructurePercent: 20,
        priceSupportPercent: 0,
        businessCollectionsPercent: 20,
        communicationsPercent: 20,
        newMarketsPercent: 20,
        newUsesPercent: 20
      }
    })
    const inputs = buildTextareaInputs({}, {}, t, application)
    expect(inputs.map((i) => i.id)).not.toContain('priceSupportDetail')
    expect(inputs).toHaveLength(5)
  })

  test('sets value from payload', () => {
    const inputs = buildTextareaInputs(
      { newInfrastructureDetail: 'some detail' },
      {},
      t,
      makeApplication()
    )
    const field = inputs.find((i) => i.id === 'newInfrastructureDetail')
    expect(field.value).toBe('some detail')
  })

  // RA-268: buildTextareaInputs now hands each field straight to GOV.UK
  // Frontend's govukCharacterCount macro, so errorMessage carries a testid
  // in `attributes` alongside its text — that's what field-error-{id} in the
  // rendered page comes from.
  test('sets errorMessage when error present', () => {
    const errors = {
      communicationsDetail: { text: 'too long error' }
    }
    const inputs = buildTextareaInputs({}, errors, t, makeApplication())
    const field = inputs.find((i) => i.id === 'communicationsDetail')
    expect(field.errorMessage).toEqual({
      text: 'too long error',
      attributes: { 'data-testid': 'field-error-communicationsDetail' }
    })
  })

  test('errorMessage is undefined when no error for field', () => {
    const inputs = buildTextareaInputs({}, {}, t, makeApplication())
    inputs.forEach((i) => expect(i.errorMessage).toBeUndefined())
  })

  test('maxlength is 500', () => {
    const inputs = buildTextareaInputs({}, {}, t, makeApplication())
    inputs.forEach((i) => expect(i.maxlength).toBe(500))
  })

  // RA-268. The value handed to the macro is normalised the same way
  // validateDetailFields counts it, so a re-render after a failed submit
  // never shows (or persists) the browser's CRLF-doubled line breaks.
  test('normalises CRLF line breaks in the value', () => {
    const inputs = buildTextareaInputs(
      { newInfrastructureDetail: 'Line one.\r\nLine two.' },
      {},
      t,
      makeApplication()
    )
    const field = inputs.find((i) => i.id === 'newInfrastructureDetail')
    expect(field.value).toBe('Line one.\nLine two.')
  })

  test('is not disabled by default', () => {
    const inputs = buildTextareaInputs({}, {}, t, makeApplication())
    inputs.forEach((i) => expect(i.attributes.disabled).toBeUndefined())
  })

  // `disabled` must be under `attributes`, not a top-level macro param:
  // character-count/template.njk builds its own govukTextarea({...}) call
  // and doesn't forward a top-level `disabled` key, so a regression here
  // wouldn't show up in the view model alone — see the rendered-HTML
  // assertion in the GET locked-application tests below for that.
  test('is disabled for every field when the section is read-only', () => {
    const inputs = buildTextareaInputs({}, {}, t, makeApplication(), true)
    expect(inputs.length).toBeGreaterThan(0)
    inputs.forEach((i) => expect(i.attributes.disabled).toBe(true))
  })
})

describe('#businessPlanDetailController', () => {
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

  describe('GET /accreditation/business-plan-detail/{applicationId}', () => {
    test('redirects to query-task-list when application is Queried and business plan section has not been started', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: {
            ...makeApplication().businessPlan,
            sectionStatus: 'NotStarted'
          }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
    })

    test('renders all seven textarea inputs, including the "other" category', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(DETAIL_FIELDS).toContain('otherDetail')
      DETAIL_FIELDS.forEach((field) => {
        expect(result).toContain(`data-testid="textarea-${field}"`)
      })
    })

    // RA-268: govuk-frontend's own CharacterCount module (already loaded
    // globally in application.js) progressively enhances each field into a
    // live "characters remaining"/"characters too many" counter that
    // updates — and clears itself — on every keystroke, before any submit.
    test('wires every textarea up as a govuk-character-count component', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      DETAIL_FIELDS.forEach((field) => {
        expect(result).toContain(`data-testid="field-group-${field}"`)
      })
      expect(result).toContain('data-module="govuk-character-count"')
      expect(result).toContain('data-maxlength="500"')
    })

    test('hides the textarea for a category with no percentage entered', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          businessPlan: {
            newInfrastructurePercent: 20,
            priceSupportPercent: 0,
            businessCollectionsPercent: 20,
            communicationsPercent: 20,
            newMarketsPercent: 20,
            newUsesPercent: 20
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(result).not.toContain('data-testid="textarea-priceSupportDetail"')
      expect(result).toContain('data-testid="textarea-newInfrastructureDetail"')
    })

    test('pre-populates textarea with existing detail values', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(result).toContain('Investing in sorting lines')
    })

    test('back link points to business-plan page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(result).toContain(
        `href="/accreditation/business-plan/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error summary when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
      DETAIL_FIELDS.forEach((field) => {
        expect(result).toContain(`data-testid="textarea-${field}"`)
      })
    })

    test('shows PRN wording for a non-exporter application', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: false })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
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
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(result).toContain('PERN income')
      expect(result).not.toContain('PRN income')
    })

    test('returns 200 for Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/business-plan-detail/${APPLICATION_ID}`
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'renders read-only (200, not a redirect) when application is locked (%s) and business plan section is not Queried',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            businessPlan: {
              ...makeApplication().businessPlan,
              sectionStatus: 'Completed'
            }
          })
        )

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: `/accreditation/business-plan-detail/${APPLICATION_ID}`
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toContain('data-testid="read-only-notice"')
        expect(result).not.toContain('data-testid="continue-button"')
        // Rendered-HTML assertion, not just the view model: catches the
        // govukCharacterCount macro silently dropping a top-level `disabled`
        // key (it only forwards `attributes`), which previously left every
        // detail textarea editable on a locked application.
        DETAIL_FIELDS.forEach((field) => {
          expect(result).toMatch(
            new RegExp(
              `<textarea[^>]*data-testid="textarea-${field}"[^>]*disabled`
            )
          )
        })
      }
    )
  })

  describe('POST /accreditation/business-plan-detail/{applicationId} - save-and-continue', () => {
    test('redirects to query-task-list when application is Queried and business plan section has not been started, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          businessPlan: {
            ...makeApplication().businessPlan,
            sectionStatus: 'NotStarted'
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: 'Details',
          priceSupportDetail: 'Details',
          businessCollectionsDetail: 'Details',
          communicationsDetail: 'Details',
          newMarketsDetail: 'Details',
          newUsesDetail: 'Details',
          otherDetail: 'Details',
          submitAction: 'saveAndContinue'
        }
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
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: 'Details',
          priceSupportDetail: 'Details',
          businessCollectionsDetail: 'Details',
          communicationsDetail: 'Details',
          newMarketsDetail: 'Details',
          newUsesDetail: 'Details',
          otherDetail: 'Details',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('patches all detail fields and redirects to business-plan-cya', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: 'Sorting lines investment',
          priceSupportDetail: 'Price support for collectors',
          businessCollectionsDetail: 'Expanding commercial collections',
          communicationsDetail: 'Public awareness campaigns',
          newMarketsDetail: 'Construction sector partnerships',
          newUsesDetail: 'Insulation manufacturing trials',
          otherDetail: 'Miscellaneous other activities',
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
          newInfrastructureDetail: 'Sorting lines investment',
          otherDetail: 'Miscellaneous other activities'
        })
      )
      expect(patchSpy.mock.calls[0][1].sectionStatus).toBeUndefined()
    })

    test('returns 400 with field error when textarea exceeds 500 chars', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
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

    // RA-268: this is what the whole live-clearing fix actually depends on —
    // application.js's initCharacterCountLiveErrorClearing only ever
    // touches an error carrying data-error-type="length" (see the comment
    // above buildTextareaInputs for why). A server render that stopped
    // emitting this attribute would silently break the fix while every
    // other assertion here kept passing, which is exactly what happened
    // once already — the attribute was correct, but the rebuilt bundle
    // that reads it hadn't shipped. This is the regression guard for the
    // half of the fix that lives in this repo.
    test('tags the too-long error with data-error-type="length" so the client can clear it live', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
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
      const errorTag = result.match(
        /<p[^>]*id="newInfrastructureDetail-error"[^>]*>/
      )
      expect(errorTag).not.toBeNull()
      expect(errorTag[0]).toContain('data-error-type="length"')
    })

    // RA-268 (the bug): a browser CRLF-normalises a textarea's line breaks
    // on submit, so a value the operator typed at exactly the 500-character
    // limit (all its maxlength ever let them enter) used to arrive here
    // longer and be rejected as "too long" through no fault of the
    // operator's. Reproduces the fix end to end through the real route.
    test('accepts a value that is exactly 500 characters once its CRLF line breaks are normalised', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const line = 'x'.repeat(30) + '\n'
      let browserCountedValue = ''
      while (browserCountedValue.length + line.length <= 500) {
        browserCountedValue += line
      }
      browserCountedValue += 'x'.repeat(500 - browserCountedValue.length)
      expect(browserCountedValue).toHaveLength(500)
      // What actually reaches the server once the browser CRLF-normalises
      // those line breaks to build the submitted request body.
      const submittedValue = browserCountedValue.replace(/\n/g, '\r\n')

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: submittedValue,
          priceSupportDetail: 'Details',
          businessCollectionsDetail: 'Details',
          communicationsDetail: 'Details',
          newMarketsDetail: 'Details',
          newUsesDetail: 'Details',
          otherDetail: 'Details',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      // Persisted with the browser's line breaks, not the wire-format CRLF
      // doubling — so re-editing the field later counts it the same way.
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({
          newInfrastructureDetail: browserCountedValue
        })
      )
    })

    test('shows PERN wording on the 400 re-render for an exporter application', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({ isExporter: true })
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
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

    // RA-268: the "required" error shares buildTextareaInputs' errorMessage
    // slot with "too long" but is a different rule the character-count
    // component knows nothing about. Confirms the client marker is scoped
    // correctly at the source, not just that initCharacterCountLiveErrorClearing
    // happens to ignore it — see the application.js test asserting the
    // client side of the same scoping.
    test('does not tag the required-field error as a length error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
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
      const errorTag = result.match(
        /<p[^>]*id="newInfrastructureDetail-error"[^>]*>/
      )
      expect(errorTag).not.toBeNull()
      expect(errorTag[0]).not.toContain('data-error-type')
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

    test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
      'redirects back to this page when application is locked (%s), without patching',
      async (applicationStatus) => {
        vi.spyOn(apiClient, 'get').mockResolvedValue(
          makeApplication({
            applicationStatus,
            businessPlan: {
              ...makeApplication().businessPlan,
              sectionStatus: 'Completed'
            }
          })
        )
        const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
          payload: {
            newInfrastructureDetail: 'Details',
            priceSupportDetail: 'Details',
            businessCollectionsDetail: 'Details',
            communicationsDetail: 'Details',
            newMarketsDetail: 'Details',
            newUsesDetail: 'Details',
            otherDetail: 'Details',
            submitAction: 'saveAndContinue'
          }
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/accreditation/business-plan-detail/${APPLICATION_ID}`
        )
        expect(patchSpy).not.toHaveBeenCalled()
      }
    )

    test('redirects back to this page (not a raw error) when the PATCH fails with a 409', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const err = Object.assign(new Error('conflict'), { status: 409 })
      vi.spyOn(apiClient, 'patch').mockRejectedValue(err)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: 'Details',
          priceSupportDetail: 'Details',
          businessCollectionsDetail: 'Details',
          communicationsDetail: 'Details',
          newMarketsDetail: 'Details',
          newUsesDetail: 'Details',
          otherDetail: 'Details',
          submitAction: 'saveAndContinue'
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/business-plan-detail/${APPLICATION_ID}`
      )
    })
  })

  describe('POST /accreditation/business-plan-detail/{applicationId} - save-and-come-later', () => {
    test('patches and redirects to task list', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
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
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/business-plan`),
        expect.objectContaining({ sectionStatus: 'InProgress' })
      )
    })

    test('re-renders the textarea with its value when it exceeds 500 chars', async () => {
      const overLength = 'a'.repeat(501)
      // RA-481: the guard fetch is now attempted even on saveAndComeLater, but
      // it must fail open (not filter fields down to whatever a leftover
      // application mock from an earlier test would imply) — force it to
      // reject here so this test isolates the "no application context"
      // behaviour saveAndComeLater always had.
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new Error('not needed for saveAndComeLater')
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/business-plan-detail/${APPLICATION_ID}`,
        payload: {
          newInfrastructureDetail: overLength,
          priceSupportDetail: '',
          businessCollectionsDetail: '',
          communicationsDetail: '',
          newMarketsDetail: '',
          newUsesDetail: '',
          submitAction: 'saveAndComeLater'
        }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="textarea-newInfrastructureDetail"')
      expect(result).toContain(overLength)
    })
  })
})
