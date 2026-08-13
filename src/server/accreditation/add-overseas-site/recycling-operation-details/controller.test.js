import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach
} from 'vitest'
import { createServer } from '../../../server.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  addOrsRecyclingOperationGetController,
  addOrsRecyclingOperationPostController
} from './controller.js'

const APPLICATION_ID = 'app-rod-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/recycling-operation-details`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/site-contact-details`
const NEXT_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

function cookiesFrom(response) {
  const raw = response.headers['set-cookie']
  if (!raw) return ''
  return Array.isArray(raw)
    ? raw.map((c) => c.split(';')[0]).join('; ')
    : raw.split(';')[0]
}

function makeMockRequest(materialType, session = {}, payload) {
  return {
    path: BASE_URL,
    params: { applicationId: APPLICATION_ID },
    payload,
    yar: {
      get: vi.fn((key) => {
        if (key === ACCREDITATION_SESSION_KEYS.materialType) return materialType
        if (key === ACCREDITATION_SESSION_KEYS.addOverseasSite) return session
        return null
      }),
      set: vi.fn()
    }
  }
}

function makeMockH() {
  return {
    view: vi.fn((view, data) => ({ ...data, code: vi.fn(() => data) })),
    redirect: vi.fn((url) => url)
  }
}

describe('#addOrsRecyclingOperationController', () => {
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

  const postHeaders = {
    ...operatorHeaders,
    'content-type': 'application/x-www-form-urlencoded'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain(
        'What recycling operations are carried out at the site?'
      )
    })

    test('renders checkboxes, not radios', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('type="checkbox"')
      expect(result).not.toContain('type="radio"')
    })

    test('back link points to site-contact-details', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    test('pre-selects codes from session when returning via Back', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCodes=R3&recyclingOperationCodes=R12'
      })
      expect(postResponse.statusCode).toBe(statusCodes.redirect)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: { ...operatorHeaders, cookie: cookiesFrom(postResponse) }
      })

      expect(result).toMatch(/value="R3"\s+checked/)
      expect(result).toMatch(/value="R12"\s+checked/)
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What recycling operations are carried out at the site?'
      )
    })
  })

  describe(`POST ${BASE_URL}`, () => {
    test('redirects to basel-convention-and-oecd-code when a valid single code is selected', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCodes=R3'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(NEXT_URL)
    })

    test('redirects and persists all codes when multiple checkboxes are selected', async () => {
      const postResponse = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload:
          'recyclingOperationCodes=R3&recyclingOperationCodes=R5&recyclingOperationCodes=R12'
      })

      expect(postResponse.statusCode).toBe(statusCodes.redirect)
      expect(postResponse.headers.location).toBe(NEXT_URL)

      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: {
          ...operatorHeaders,
          cookie: cookiesFrom(postResponse)
        }
      })

      expect(result).toMatch(/value="R3"\s+checked/)
      expect(result).toMatch(/value="R5"\s+checked/)
      expect(result).toMatch(/value="R12"\s+checked/)
    })

    test('returns 400 with error when no operation is selected', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select at least one recycling operation')
      expect(result).toContain('id="recycling-operation-code-error"')
      expect(result).toContain(
        'aria-describedby="recycling-operation-code-error"'
      )
    })

    test('returns 400 with error when a code outside R3/R4/R5/R12/R13 is submitted', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'recyclingOperationCodes=R7'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('Select at least one recycling operation')
    })

    describe('AC07 — R12/R13 require an accompanying code', () => {
      test.each([['R12'], ['R13'], ['R12,R13']])(
        'returns 400 when only %s is selected',
        async (codesCsv) => {
          const payload = codesCsv
            .split(',')
            .map((c) => `recyclingOperationCodes=${c}`)
            .join('&')

          const { statusCode, result } = await server.inject({
            method: 'POST',
            url: BASE_URL,
            headers: postHeaders,
            payload
          })

          expect(statusCode).toBe(statusCodes.badRequest)
          expect(result).toContain(
            'R12 and R13 cannot be selected on their own'
          )
        }
      )

      test.each([
        ['R3', 'R12'],
        ['R4', 'R13']
      ])('allows %s + %s (accompanied)', async (codeA, codeB) => {
        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: BASE_URL,
          headers: postHeaders,
          payload: `recyclingOperationCodes=${codeA}&recyclingOperationCodes=${codeB}`
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(NEXT_URL)
      })

      test('allows the full R3+R4+R5+R12+R13 combination', async () => {
        const { statusCode, headers } = await server.inject({
          method: 'POST',
          url: BASE_URL,
          headers: postHeaders,
          payload:
            'recyclingOperationCodes=R3&recyclingOperationCodes=R4&recyclingOperationCodes=R5&recyclingOperationCodes=R12&recyclingOperationCodes=R13'
        })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(NEXT_URL)
      })
    })
  })

  describe('materialType branching (unit)', () => {
    test.each([
      ['Aluminium', ['R4', 'R12', 'R13']],
      ['Fibre', ['R3', 'R5', 'R12', 'R13']],
      ['Glass', ['R5', 'R12', 'R13']],
      ['Paper', ['R3', 'R12', 'R13']],
      ['Plastic', ['R3', 'R12', 'R13']],
      ['Steel', ['R4', 'R12', 'R13']],
      ['Wood', ['R3', 'R12', 'R13']]
    ])(
      'shows only %s codes for materialType %s',
      async (materialType, expectedCodes) => {
        const mockH = makeMockH()
        const data = addOrsRecyclingOperationGetController.handler(
          makeMockRequest(materialType),
          mockH
        )

        expect(data.options.map((o) => o.value).sort()).toEqual(
          [...expectedCodes].sort()
        )
      }
    )

    test('shows all codes when materialType is unset (graceful fallback)', async () => {
      const mockH = makeMockH()
      const data = addOrsRecyclingOperationGetController.handler(
        makeMockRequest(null),
        mockH
      )

      expect(data.options.map((o) => o.value).sort()).toEqual(
        ['R3', 'R4', 'R5', 'R12', 'R13'].sort()
      )
    })

    test('re-displays only the new materialType codes after it changes, dropping stale selections', async () => {
      const mockH = makeMockH()
      const data = addOrsRecyclingOperationGetController.handler(
        makeMockRequest('Wood', { recyclingOperationCodes: ['R4', 'R12'] }),
        mockH
      )

      expect(data.options.map((o) => o.value).sort()).toEqual(
        ['R3', 'R12', 'R13'].sort()
      )
      expect(data.options.find((o) => o.value === 'R12').checked).toBe(true)
    })

    test('POST rejects a code that is valid overall but not applicable to the current materialType', () => {
      const mockH = makeMockH()
      const data = addOrsRecyclingOperationPostController.handler(
        makeMockRequest('Wood', {}, { recyclingOperationCodes: 'R4' }),
        mockH
      )

      expect(mockH.redirect).not.toHaveBeenCalled()
      expect(data.error).toBeTruthy()
    })

    test('POST accepts a code that is applicable to the current materialType', () => {
      const mockH = makeMockH()
      addOrsRecyclingOperationPostController.handler(
        makeMockRequest('Wood', {}, { recyclingOperationCodes: 'R3' }),
        mockH
      )

      expect(mockH.redirect).toHaveBeenCalledWith(NEXT_URL)
    })
  })
})
