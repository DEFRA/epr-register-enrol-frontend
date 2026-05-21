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
  buildFilesViewModel,
  hasEligibleFile,
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES
} from './controller.js'

const APPLICATION_ID = 'app-sampling-001'

function makeApplication(overrides = {}) {
  return {
    applicationId: APPLICATION_ID,
    organisationId: 'test-operator-id',
    materialType: 'Steel',
    year: 2027,
    siteId: 'site-001',
    prns: { sectionStatus: 'Completed' },
    businessPlan: { sectionStatus: 'Completed' },
    samplingPlan: {
      sectionStatus: 'NotStarted',
      files: []
    },
    ...overrides
  }
}

function makeFile(overrides = {}) {
  return {
    fileId: 'file-001',
    filename: 'sampling-plan.pdf',
    contentType: 'application/pdf',
    uploadedAt: '2027-03-01T10:00:00Z',
    uploadedBy: 'test-operator-id',
    scanStatus: 'Pending',
    ...overrides
  }
}

describe('#validateFileExtension', () => {
  test('returns true for all allowed extensions', () => {
    ALLOWED_EXTENSIONS.forEach((ext) => {
      expect(validateFileExtension(`file.${ext}`)).toBe(true)
    })
  })

  test('returns true for uppercase allowed extension', () => {
    expect(validateFileExtension('file.PDF')).toBe(true)
    expect(validateFileExtension('file.DOCX')).toBe(true)
  })

  test('returns false for disallowed extension', () => {
    expect(validateFileExtension('file.exe')).toBe(false)
    expect(validateFileExtension('file.zip')).toBe(false)
    expect(validateFileExtension('file.js')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(validateFileExtension('')).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(validateFileExtension(undefined)).toBe(false)
  })

  test('returns false for filename with no extension', () => {
    expect(validateFileExtension('filewithnoext')).toBe(false)
  })
})

describe('#buildFilesViewModel', () => {
  test('maps file properties to view model', () => {
    const files = [makeFile()]
    const result = buildFilesViewModel(files)
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('sampling-plan.pdf')
    expect(result[0].fileId).toBe('file-001')
    expect(result[0].scanStatus).toBe('Pending')
  })

  test('formats uploadedAt as en-GB date', () => {
    const files = [makeFile({ UploadedAt: '2027-03-01T10:00:00Z' })]
    const result = buildFilesViewModel(files)
    expect(result[0].uploadedAt).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  test('returns empty array for undefined input', () => {
    expect(buildFilesViewModel(undefined)).toEqual([])
  })

  test('defaults scanStatus to Pending when missing', () => {
    const result = buildFilesViewModel([{ fileId: 'x', filename: 'a.pdf' }])
    expect(result[0].scanStatus).toBe('Pending')
  })
})

describe('#hasEligibleFile', () => {
  test('returns true when at least one Pending file exists', () => {
    expect(hasEligibleFile([makeFile({ scanStatus: 'Pending' })])).toBe(true)
  })

  test('returns true when at least one Clean file exists', () => {
    expect(hasEligibleFile([makeFile({ scanStatus: 'Clean' })])).toBe(true)
  })

  test('returns false when all files are Infected', () => {
    expect(
      hasEligibleFile([
        makeFile({ scanStatus: 'Infected' }),
        makeFile({ scanStatus: 'Infected' })
      ])
    ).toBe(false)
  })

  test('returns true when mixed Infected and Clean', () => {
    expect(
      hasEligibleFile([
        makeFile({ scanStatus: 'Infected' }),
        makeFile({ scanStatus: 'Clean' })
      ])
    ).toBe(true)
  })

  test('returns false for empty array', () => {
    expect(hasEligibleFile([])).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(hasEligibleFile(undefined)).toBe(false)
  })
})

describe('#MAX_FILE_BYTES', () => {
  test('is exactly 20MB', () => {
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024)
  })
})

describe('#samplingPlanUploadController', () => {
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

  describe('GET /accreditation/sampling-plan/{applicationId}', () => {
    test('returns 200 with page heading', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="page-heading"')
      expect(result).toContain(
        'Upload accreditation sampling and inspection plan'
      )
    })

    test('renders file requirements list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="file-requirements"')
      expect(result).toContain('20MB')
      expect(result).toContain('PDF')
    })

    test('does not render files table when no files uploaded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="uploaded-files-table"')
    })

    test('renders uploaded files table when files exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile()]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="uploaded-files-table"')
      expect(result).toContain('sampling-plan.pdf')
    })

    test('shows Scanning tag for Pending file', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ scanStatus: 'Pending' })]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('Scanning')
    })

    test('back link points to task list', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/task-list/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain(
        '[Welsh] Upload accreditation sampling and inspection plan'
      )
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — saveAndContinue', () => {
    test('returns 400 with error when no files uploaded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain(
        'You must upload at least one file before continuing'
      )
    })

    test('returns 400 when all files are Infected', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ scanStatus: 'Infected' })]
          }
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain(
        'You must upload at least one file before continuing'
      )
    })

    test('patches SectionStatus Completed and redirects to task list when eligible file exists', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ scanStatus: 'Pending' })]
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/sampling-plan`),
        { sectionStatus: 'Completed' }
      )
    })

    test('returns 500 when patch fails on saveAndContinue', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile()]
          }
        })
      )
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('Patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — saveAndComeLater', () => {
    test('patches InProgress and redirects to task list when files exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'NotStarted',
            files: [makeFile()]
          }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/sampling-plan`),
        { sectionStatus: 'InProgress' }
      )
    })

    test('patches NotStarted when no files exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(patchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${APPLICATION_ID}/sampling-plan`),
        { sectionStatus: 'NotStarted' }
      )
    })

    test('returns 500 when patch fails on saveAndComeLater', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(new Error('Patch failed'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — deleteFile', () => {
    test('calls delete and redirects to GET', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const deleteSpy = vi
        .spyOn(apiClient, 'delete')
        .mockResolvedValue(undefined)

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'deleteFile', fileId: 'file-001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}`
      )
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.stringContaining('file-001')
      )
    })

    test('returns 500 when delete API fails', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.spyOn(apiClient, 'delete').mockRejectedValue(
        new Error('Delete failed')
      )

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'deleteFile', fileId: 'file-001' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('redirects without calling delete when no fileId provided', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const deleteSpy = vi.spyOn(apiClient, 'delete')

      const { statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'deleteFile' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(deleteSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — uploadFile', () => {
    const boundary = 'test-boundary-abc123'
    const multipartContentType = `multipart/form-data; boundary=${boundary}`

    function buildMultipartPayload({
      filename = 'test.png',
      contentType = 'image/png',
      fileBytes = Buffer.from('fake-content')
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

      buffers.push(Buffer.from(`--${boundary}--${CRLF}`))
      return Buffer.concat(buffers)
    }

    test('valid file initiates CDP upload and redirects to status page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({ ok: true })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'sampling-plan.png',
          contentType: 'image/png'
        })
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/status`
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/stub/cdp-upload/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-filename': 'sampling-plan.png'
          })
        })
      )
    })

    test('empty filename returns 400 with noFile error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({ filename: '' })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Select a file to upload')
    })

    test('disallowed extension returns 400 with invalidType error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'malware.exe',
          contentType: 'application/octet-stream'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('PDF')
    })

    test('CDP proxy failure returns 500 with uploadError', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, statusText: 'Error' })

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'plan.pdf',
          contentType: 'application/pdf'
        })
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('problem uploading your file')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — GET fetch failure', () => {
    test('returns 500 when initial GET fails on any POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
