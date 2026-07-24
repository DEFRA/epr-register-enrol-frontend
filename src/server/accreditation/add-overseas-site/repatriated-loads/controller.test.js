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
import { config } from '../../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { addOrsRepatriatedLoadsPostController } from './controller.js'

const APPLICATION_ID = 'app-rl-001'
const BASE_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/repatriated-loads`
const BACK_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/basel-convention-and-oecd-code`
const CONDITIONS_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/conditions-of-export`
const CYA_URL = `/accreditation/add-overseas-site/${APPLICATION_ID}/check-your-answers`
const SELECT_ORS_URL = `/accreditation/select-overseas-sites/${APPLICATION_ID}`

const VALID_TEXT =
  'Rejected loads are returned by courier within 30 days at our expense.'

function makeMockRequest(materialType, text = VALID_TEXT) {
  return {
    path: `/accreditation/add-overseas-site/${APPLICATION_ID}/repatriated-loads`,
    payload: { repatriatedLoads: text },
    params: { applicationId: APPLICATION_ID },
    yar: {
      get: vi.fn((key) => {
        if (key === ACCREDITATION_SESSION_KEYS.materialType) return materialType
        if (key === ACCREDITATION_SESSION_KEYS.addOverseasSite) return {}
        return null
      }),
      set: vi.fn()
    }
  }
}

function makeMockH() {
  return { redirect: vi.fn((url) => url) }
}

describe('#addOrsRepatriatedLoadsController', () => {
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
        'What are the arrangements for loads rejected or returned to the UK?'
      )
    })

    test('renders textarea', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="repatriated-loads-textarea"')
    })

    test('back link points to basel-convention-and-oecd-code', async () => {
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

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] What are the arrangements for loads rejected or returned to the UK?'
      )
    })
  })

  describe('materialType branching (unit)', () => {
    test('redirects to check-your-answers when materialType is Plastic', async () => {
      const mockH = makeMockH()
      await addOrsRepatriatedLoadsPostController.handler(
        makeMockRequest('Plastic'),
        mockH
      )
      expect(mockH.redirect).toHaveBeenCalledWith(CYA_URL)
    })

    test('redirects to check-your-answers when materialType is null (no session)', async () => {
      const mockH = makeMockH()
      await addOrsRepatriatedLoadsPostController.handler(
        makeMockRequest(null),
        mockH
      )
      expect(mockH.redirect).toHaveBeenCalledWith(CYA_URL)
    })

    test('redirects to conditions-of-export when materialType is Steel', async () => {
      const mockH = makeMockH()
      await addOrsRepatriatedLoadsPostController.handler(
        makeMockRequest('Steel'),
        mockH
      )
      expect(mockH.redirect).toHaveBeenCalledWith(CONDITIONS_URL)
    })

    test('redirects to conditions-of-export when materialType is Aluminium', async () => {
      const mockH = makeMockH()
      await addOrsRepatriatedLoadsPostController.handler(
        makeMockRequest('Aluminium'),
        mockH
      )
      expect(mockH.redirect).toHaveBeenCalledWith(CONDITIONS_URL)
    })
  })

  describe(`POST ${BASE_URL} (HTTP)`, () => {
    test('returns 400 with error when text is empty', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'repatriatedLoads='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain(
        'Describe the arrangements for loads that are rejected or returned to the UK'
      )
    })

    test('returns 400 when text exceeds 500 words', async () => {
      const tooManyWords = Array(502).fill('word').join(' ')
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: `repatriatedLoads=${encodeURIComponent(tooManyWords)}`
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Description must be 500 words or fewer')
    })

    test('accepts exactly 500 words and redirects', async () => {
      const exactly500 = Array(500).fill('word').join(' ')
      const { statusCode } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: `repatriatedLoads=${encodeURIComponent(exactly500)}`
      })

      expect(statusCode).toBe(statusCodes.redirect)
    })
  })
})
