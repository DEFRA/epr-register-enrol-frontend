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
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
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
        if (key === ACCREDITATION_SESSION_KEYS.materialType) {
          return materialType
        }
        if (key === ACCREDITATION_SESSION_KEYS.addOverseasSite) {
          return {}
        }
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
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const postHeaders = {
    'content-type': 'application/x-www-form-urlencoded'
  }

  describe(`GET ${BASE_URL}`, () => {
    test('returns 200 with page heading', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: BASE_URL
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
        url: BASE_URL
      })

      expect(result).toContain('data-testid="repatriated-loads-textarea"')
    })

    // RA-361: govuk-frontend's own CharacterCount module (already loaded
    // globally in application.js) progressively enhances this field into a
    // live "words remaining"/"words too many" counter that updates — and
    // clears itself — on every keystroke, before any submit. It previously
    // had none of that: the "up to 500 words" line was static text with no
    // data-module behind it.
    test('wires the textarea up as a govuk-character-count component', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL
      })

      expect(result).toContain('data-module="govuk-character-count"')
      expect(result).toContain('data-maxwords="500"')
      expect(result).toContain('data-testid="repatriated-loads-textarea"')
    })

    test('back link points to basel-convention-and-oecd-code', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL
      })

      expect(result).toContain('data-testid="back-link"')
      expect(result).toContain(BACK_URL)
    })

    test('cancel link points to select-overseas-sites', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: BASE_URL
      })

      expect(result).toContain('data-testid="cancel-link"')
      expect(result).toContain(SELECT_ORS_URL)
    })

    // RA-481: this wizard holds its draft in session, not on the
    // application, so once overseasSites is locked there's nothing
    // meaningful to render read-only — send the operator back to the
    // section's list page instead.
    test('redirects to select-overseas-sites when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: BASE_URL
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

    test('returns 200 in Welsh locale', async () => {
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy${BASE_URL}`
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
    test('redirects to select-overseas-sites without saving when the application is locked (Submitted) and overseasSites is not Queried', async () => {
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValueOnce(
        {
          applicationStatus: 'Submitted',
          overseasSites: { sectionStatus: 'Completed' }
        }
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'repatriatedLoads=Some+description+text'
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(SELECT_ORS_URL)
    })

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

    // RA-361: the "required" (empty) error shares buildTextareaInput's
    // errorMessage slot with "too many words" but isn't a length rule the
    // character-count component knows about — confirms it is NOT tagged, the
    // counterpart to the tagged case below. Mirrors the same pair of tests
    // on business-plan-detail.
    test('does not tag the empty-text error as a length error', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: 'repatriatedLoads='
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      const errorTag = result.match(/<p[^>]*id="repatriated-loads-error"[^>]*>/)
      expect(errorTag).not.toBeNull()
      expect(errorTag[0]).not.toContain('data-error-type')
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

    // RA-361: this is what the live-clearing fix in application.js actually
    // depends on — initCharacterCountLiveErrorClearing only ever touches an
    // error carrying data-error-type="length". Regression guard for the
    // half of the fix that lives in this repo (found missing once already,
    // when the rebuilt bundle that reads it hadn't been redeployed).
    test('tags the too-many-words error with data-error-type="length" so the client can clear it live', async () => {
      const tooManyWords = Array(502).fill('word').join(' ')
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: postHeaders,
        payload: `repatriatedLoads=${encodeURIComponent(tooManyWords)}`
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      const errorTag = result.match(/<p[^>]*id="repatriated-loads-error"[^>]*>/)
      expect(errorTag).not.toBeNull()
      expect(errorTag[0]).toContain('data-error-type="length"')
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

  // RA-620: every limit mirrors the backend's validator, so the value one past
  // it is refused here, inline, rather than as a 400 at check-your-answers.
  describe('RA-620: backend length limits', () => {
    const limitPostHeaders = {
      'content-type': 'application/x-www-form-urlencoded'
    }
    const postForm = (fields) =>
      server.inject({
        method: 'POST',
        url: BASE_URL,
        headers: limitPostHeaders,
        payload: new URLSearchParams(fields).toString()
      })

    test('accepts 5000 characters', async () => {
      const { statusCode } = await postForm({
        repatriatedLoads: 'a'.repeat(5000)
      })
      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('refuses 5001 characters even when under the 500-word limit', async () => {
      const text = 'a'.repeat(5001)
      const { statusCode, result } = await postForm({ repatriatedLoads: text })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Description must be 5,000 characters or less')
      expect(result).toContain(text)
      expect(result).not.toContain('data-error-type="length"')
    })

    test('counts line breaks as the CRLF the browser submits', async () => {
      const text = `${'a'.repeat(2499)}\r\n${'b'.repeat(2500)}`
      expect(text).toHaveLength(5001)
      const { statusCode } = await postForm({ repatriatedLoads: text })
      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })
})
