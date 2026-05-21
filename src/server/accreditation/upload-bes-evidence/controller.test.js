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
  validateFileExtension,
  parseDate,
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES
} from './controller.js'

const APPLICATION_ID = 'app-bes-001'
const SITE_ID = '900001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Plastic',
    year: 2027,
    isExporter: true,
    overseasSites: {
      sectionStatus: 'InProgress',
      sites: [
        {
          siteId: 900001,
          siteName: 'Site Alpha',
          siteAddress: '123 Test St',
          country: 'Germany',
          isEu: true,
          isOecd: true,
          besEvidence: { besEvidenceUploads: [] }
        }
      ]
    },
    besEvidence: { sectionStatus: 'NotStarted' },
    ...overrides
  }
}

describe('#validateFileExtension', () => {
  test('returns true for all allowed extensions', () => {
    ALLOWED_EXTENSIONS.forEach((ext) => {
      expect(validateFileExtension(`file.${ext}`)).toBe(true)
    })
  })

  test('returns true for uppercase extension', () => {
    expect(validateFileExtension('file.PDF')).toBe(true)
  })

  test('returns false for disallowed extension', () => {
    expect(validateFileExtension('file.exe')).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(validateFileExtension(undefined)).toBe(false)
  })

  test('returns false for filename with no extension', () => {
    expect(validateFileExtension('filenodot')).toBe(false)
  })
})

describe('#parseDate', () => {
  test('returns a Date for valid inputs', () => {
    const d = parseDate('1', '11', '2026')
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(1)
  })

  test('returns null for non-numeric inputs', () => {
    expect(parseDate('x', '11', '2026')).toBeNull()
    expect(parseDate('1', 'y', '2026')).toBeNull()
  })

  test('returns null for invalid calendar date (Feb 31)', () => {
    expect(parseDate('31', '2', '2026')).toBeNull()
  })
})

describe('#MAX_FILE_BYTES', () => {
  test('is exactly 20MB', () => {
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024)
  })
})

describe('#uploadBesEvidenceController', () => {
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

  const boundary = 'test-boundary-bes'
  const multipartContentType = `multipart/form-data; boundary=${boundary}`

  function buildMultipartPayload({
    filename = 'evidence.pdf',
    contentType = 'application/pdf',
    fileBytes = Buffer.from('fake-content'),
    validFromDay = '1',
    validFromMonth = '11',
    validFromYear = '2026',
    validToDay = '30',
    validToMonth = '11',
    validToYear = '2027'
  } = {}) {
    const CRLF = '\r\n'
    const buffers = []

    buffers.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="action"${CRLF}` +
          CRLF +
          `uploadFile${CRLF}`
      )
    )

    if (filename !== '') {
      buffers.push(
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
            `Content-Type: ${contentType}${CRLF}` +
            CRLF
        )
      )
      buffers.push(fileBytes)
      buffers.push(Buffer.from(CRLF))
    } else {
      buffers.push(
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename=""${CRLF}` +
            `Content-Type: application/octet-stream${CRLF}` +
            CRLF +
            CRLF
        )
      )
    }

    for (const [name, value] of [
      ['validFromDay', validFromDay],
      ['validFromMonth', validFromMonth],
      ['validFromYear', validFromYear],
      ['validToDay', validToDay],
      ['validToMonth', validToMonth],
      ['validToYear', validToYear]
    ]) {
      buffers.push(
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="${name}"${CRLF}` +
            CRLF +
            `${value}${CRLF}`
        )
      )
    }

    buffers.push(Buffer.from(`--${boundary}--${CRLF}`))
    return Buffer.concat(buffers)
  }

  describe('GET /accreditation/upload-bes-evidence/{applicationId}/{siteId}', () => {
    test('returns 200 with page heading including site name', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain('Upload BES evidence for')
      expect(result).toContain('Site Alpha')
    })

    test('renders file upload input and date fields', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="file-input"')
      expect(result).toContain('data-testid="valid-from-date"')
      expect(result).toContain('data-testid="valid-to-date"')
    })

    test('returns 500 when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Upload BES evidence for')
    })
  })

  describe('POST /accreditation/upload-bes-evidence/{applicationId}/{siteId} — saveAndComeLater', () => {
    test('redirects to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
    })

    test('returns 500 when GET application fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/upload-bes-evidence/{applicationId}/{siteId} — uploadFile', () => {
    test('returns 400 when no file selected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({ filename: '' })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('Select a file to upload')
    })

    test('returns 400 for invalid file extension', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({ filename: 'malware.exe' })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
    })

    test('returns 400 for missing valid-from date', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          validFromDay: 'x',
          validFromMonth: 'y',
          validFromYear: 'z'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="valid-from-error"')
    })

    test('returns 400 for missing valid-to date', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          validToDay: 'x',
          validToMonth: 'y',
          validToYear: 'z'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="valid-to-error"')
    })

    test('returns 400 when valid-to is before valid-from', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          validFromDay: '1',
          validFromMonth: '11',
          validFromYear: '2027',
          validToDay: '1',
          validToMonth: '1',
          validToYear: '2026'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="valid-to-error"')
      expect(result).toContain('The end date must be after the start date')
    })

    test('valid file and dates redirects to upload-more-evidence', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postSpy = vi
        .spyOn(apiClient, 'post')
        .mockResolvedValue({ FileId: 'new-bes-001' })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload()
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toContain(
        `/accreditation/upload-more-evidence/${APPLICATION_ID}/${SITE_ID}`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `${APPLICATION_ID}/overseas-sites/900001/bes-evidence/files`
        ),
        expect.objectContaining({
          filename: 'evidence.pdf',
          contentType: 'application/pdf'
        })
      )
    })

    test('returns 500 when addBesEvidenceFile fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('upload failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload()
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="file-error"')
    })
  })

  describe('POST /accreditation/upload-bes-evidence/{applicationId}/{siteId} — 413 payload too large', () => {
    const largeBoundary = 'test-boundary-413-bes'
    const largeContentType = `multipart/form-data; boundary=${largeBoundary}`

    function buildOversizePayload() {
      const CRLF = '\r\n'
      const oversizeBytes = Buffer.alloc(22 * 1024 * 1024, 'x')
      return Buffer.concat([
        Buffer.from(
          `--${largeBoundary}${CRLF}` +
            `Content-Disposition: form-data; name="action"${CRLF}` +
            CRLF +
            `uploadFile${CRLF}`
        ),
        Buffer.from(
          `--${largeBoundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename="large.pdf"${CRLF}` +
            `Content-Type: application/pdf${CRLF}` +
            CRLF
        ),
        oversizeBytes,
        Buffer.from(CRLF),
        Buffer.from(`--${largeBoundary}--${CRLF}`)
      ])
    }

    test('returns 400 with fileTooLarge error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': largeContentType },
        payload: buildOversizePayload()
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('The selected file must be smaller than 20MB')
    })

    test('renders 400 with empty site name when GET fails during 413 handling', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/upload-bes-evidence/${APPLICATION_ID}/${SITE_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': largeContentType },
        payload: buildOversizePayload()
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('The selected file must be smaller than 20MB')
    })
  })
})
