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
import { buildMaterialOptions, isAlreadyApplied } from './controller.js'

const CURRENT_YEAR = new Date().getFullYear()

const t = (key) => key.split('.').pop()

const mockApplicationSteel = {
  ApplicationId: 'app-steel-001',
  ApplicationStatus: 'Started',
  MaterialType: 'Steel',
  Year: CURRENT_YEAR
}

const mockApplicationWood = {
  ApplicationId: 'app-wood-001',
  ApplicationStatus: 'Sent',
  MaterialType: 'Wood',
  Year: CURRENT_YEAR
}

const mockSeedResponse = {
  ApplicationId: 'new-app-001',
  ApplicationStatus: 'Saved',
  MaterialType: 'Aluminium',
  Year: CURRENT_YEAR
}

describe('#buildMaterialOptions', () => {
  test('returns all 7 materials with waste codes in text', () => {
    const options = buildMaterialOptions([], null, CURRENT_YEAR, t)
    expect(options).toHaveLength(7)
    expect(options.find((o) => o.value === 'Steel').text).toContain('(R4)')
    expect(options.find((o) => o.value === 'Wood').text).toContain('(R3)')
    expect(options.find((o) => o.value === 'Aluminium').text).toContain('(R4)')
    expect(options.find((o) => o.value === 'Fibre').text).toContain('(R3)')
    expect(options.find((o) => o.value === 'Glass').text).toContain('(R5)')
    expect(options.find((o) => o.value === 'Paper').text).toContain('(R3)')
    expect(options.find((o) => o.value === 'Plastic').text).toContain('(R3)')
  })

  test('no material is checked when selectedMaterial is null', () => {
    const options = buildMaterialOptions([], null, CURRENT_YEAR, t)
    expect(options.every((o) => !o.checked)).toBe(true)
  })

  test('selected material has checked=true', () => {
    const options = buildMaterialOptions([], 'Steel', CURRENT_YEAR, t)
    const steel = options.find((o) => o.value === 'Steel')
    expect(steel.checked).toBe(true)
    expect(options.filter((o) => o.checked)).toHaveLength(1)
  })

  test('material with existing application for current year is disabled with hint', () => {
    const options = buildMaterialOptions(
      [mockApplicationSteel],
      null,
      CURRENT_YEAR,
      t
    )
    const steel = options.find((o) => o.value === 'Steel')
    expect(steel.disabled).toBe(true)
    expect(steel.hint).not.toBeNull()
    expect(steel.hint.text).toBe('alreadyApplied')
  })

  test('material with application from a different year is not disabled', () => {
    const oldYearApp = { ...mockApplicationSteel, Year: CURRENT_YEAR - 1 }
    const options = buildMaterialOptions([oldYearApp], null, CURRENT_YEAR, t)
    const steel = options.find((o) => o.value === 'Steel')
    expect(steel.disabled).toBe(false)
    expect(steel.hint).toBeNull()
  })

  test('only the applied material is disabled when one application exists', () => {
    const options = buildMaterialOptions(
      [mockApplicationSteel],
      null,
      CURRENT_YEAR,
      t
    )
    const disabled = options.filter((o) => o.disabled)
    expect(disabled).toHaveLength(1)
    expect(disabled[0].value).toBe('Steel')
  })

  test('multiple applied materials are all disabled', () => {
    const options = buildMaterialOptions(
      [mockApplicationSteel, mockApplicationWood],
      null,
      CURRENT_YEAR,
      t
    )
    const disabled = options.filter((o) => o.disabled)
    expect(disabled).toHaveLength(2)
    expect(disabled.map((o) => o.value)).toEqual(
      expect.arrayContaining(['Steel', 'Wood'])
    )
  })

  test('non-disabled materials have null hint', () => {
    const options = buildMaterialOptions(
      [mockApplicationSteel],
      null,
      CURRENT_YEAR,
      t
    )
    const wood = options.find((o) => o.value === 'Wood')
    expect(wood.disabled).toBe(false)
    expect(wood.hint).toBeNull()
  })
})

describe('#isAlreadyApplied', () => {
  test('returns true when materialType has application for current year', () => {
    expect(
      isAlreadyApplied([mockApplicationSteel], 'Steel', CURRENT_YEAR)
    ).toBe(true)
  })

  test('returns false when materialType has no application for current year', () => {
    expect(isAlreadyApplied([mockApplicationSteel], 'Wood', CURRENT_YEAR)).toBe(
      false
    )
  })

  test('returns false when application exists for a different year', () => {
    const oldApp = { ...mockApplicationSteel, Year: CURRENT_YEAR - 1 }
    expect(isAlreadyApplied([oldApp], 'Steel', CURRENT_YEAR)).toBe(false)
  })

  test('returns false for empty applications list', () => {
    expect(isAlreadyApplied([], 'Steel', CURRENT_YEAR)).toBe(false)
  })
})

describe('#materialSelectionGetController / #materialSelectionPostController', () => {
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

  describe('GET /accreditation/material-selection', () => {
    test('returns 200 with all 7 material radio options', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/accreditation/material-selection',
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Which material is this application for?')
      expect(result).toContain('Steel (R4)')
      expect(result).toContain('Wood (R3)')
      expect(result).toContain('Aluminium (R4)')
      expect(result).toContain('Fibre (R3)')
      expect(result).toContain('Glass (R5)')
      expect(result).toContain('Paper (R3)')
      expect(result).toContain('Plastic (R3)')
    })

    test('renders back link to operator accreditation page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/accreditation/material-selection',
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('href="/operator-accreditation"')
    })

    test('shows disabled radio with already-applied hint for existing material', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([mockApplicationSteel])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/accreditation/material-selection',
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Already applied')
      expect(result).toMatch(/disabled[^>]*>[\s\S]*?Steel \(R4\)/)
    })

    test('returns 200 even when API call fails (graceful degradation)', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/accreditation/material-selection',
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Which material is this application for?')
      expect(result).toContain('Steel (R4)')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/cy/accreditation/material-selection',
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Which material is this application for?'
      )
    })
  })

  describe('POST /accreditation/material-selection', () => {
    test('returns 400 with validation error when no material selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select a material for this application')
    })

    test('shows error in both error summary and field error on no selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="field-error"')
      expect(result).toContain('Select a material for this application')
    })

    test('error summary contains GDS required h2 heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      const { result } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: ''
      })

      expect(result).toContain('govuk-error-summary__title')
      expect(result).toContain('There is a problem')
    })

    test('returns 400 when POSTing an already-applied material', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([mockApplicationSteel])

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Steel'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Already applied')
    })

    test('does not call seed API when POSTing an already-applied material', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      vi.spyOn(apiClient, 'get').mockResolvedValue([mockApplicationSteel])

      await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Steel'
      })

      expect(postSpy).not.toHaveBeenCalled()
    })

    test('redirects to task list on valid selection', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])
      vi.spyOn(apiClient, 'post').mockResolvedValue(mockSeedResponse)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Aluminium'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/task-list/${mockSeedResponse.ApplicationId}`
      )
    })

    test('calls seed API with correct materialType and current year', async () => {
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue(mockSeedResponse)
      vi.spyOn(apiClient, 'get').mockResolvedValue([])

      await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Aluminium'
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/seed'),
        expect.objectContaining({
          materialType: 'Aluminium',
          year: CURRENT_YEAR,
          siteId: null
        })
      )
    })

    test('returns 500 with error message when seed API fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Seed failed'))

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Aluminium'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain(
        'Sorry, we were unable to create your application'
      )
    })

    test('re-renders form with selected material checked after seed API failure', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue([])
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Seed failed'))

      const { result } = await server.inject({
        method: 'POST',
        url: '/accreditation/material-selection',
        headers: {
          ...operatorHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: 'materialType=Aluminium'
      })

      expect(result).toContain('value="Aluminium"')
      expect(result).toContain('checked')
    })
  })
})
