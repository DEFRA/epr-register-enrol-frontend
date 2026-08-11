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
  documentTypeLabel,
  documentTypeOptions,
  ALLOWED_EXTENSIONS,
  DOCUMENT_TYPES,
  MAX_FILE_BYTES
} from './controller.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'

vi.mock('../../common/helpers/upload/init-upload.js', () => ({
  initUpload: vi.fn()
}))

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
    documentType: 'SamplingPlan',
    ...overrides
  }
}

function stubT(key) {
  const labels = {
    'pages.samplingPlanUpload.documentType.samplingPlan':
      'Sampling and inspection plan',
    'pages.samplingPlanUpload.documentType.supportingEvidence':
      'Supporting evidence',
    'pages.samplingPlanUpload.documentType.notSpecified': 'Not specified'
  }
  return labels[key] ?? key
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

  test('includes documentType in the view model', () => {
    const result = buildFilesViewModel([
      makeFile({ documentType: 'SupportingEvidence' })
    ])
    expect(result[0].documentType).toBe('SupportingEvidence')
  })

  test('defaults documentType to null when missing', () => {
    const result = buildFilesViewModel([{ fileId: 'x', filename: 'a.pdf' }])
    expect(result[0].documentType).toBeNull()
  })
})

describe('#documentTypeLabel', () => {
  test('resolves SamplingPlan to its translated label', () => {
    expect(documentTypeLabel(stubT, 'SamplingPlan')).toBe(
      'Sampling and inspection plan'
    )
  })

  test('resolves SupportingEvidence to its translated label', () => {
    expect(documentTypeLabel(stubT, 'SupportingEvidence')).toBe(
      'Supporting evidence'
    )
  })

  test('falls back to notSpecified for null', () => {
    expect(documentTypeLabel(stubT, null)).toBe('Not specified')
  })

  test('falls back to notSpecified for an unrecognised value', () => {
    expect(documentTypeLabel(stubT, 'SomethingElse')).toBe('Not specified')
  })
})

describe('#documentTypeOptions', () => {
  test('returns both document type options with translated labels', () => {
    const result = documentTypeOptions(stubT)
    expect(result).toEqual([
      { value: 'SamplingPlan', label: 'Sampling and inspection plan' },
      { value: 'SupportingEvidence', label: 'Supporting evidence' }
    ])
  })

  test('one option per DOCUMENT_TYPES entry', () => {
    expect(documentTypeOptions(stubT)).toHaveLength(DOCUMENT_TYPES.length)
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
    vi.mocked(initUpload).mockResolvedValue({
      fileUploadId: 'stub-test-id',
      uploadUrl: 'http://stub/upload/stub-test-id',
      statusUrl: 'http://stub/status/stub-test-id'
    })
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
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
      expect(result).toContain('Upload sampling and inspection plan')
    })

    test('renders the enhanced file upload field with label, hint and testid', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="file-input"')
      expect(result).toContain('data-module="govuk-file-upload"')
      expect(result).toContain('Upload a file')
      expect(result).toContain('20MB')
      expect(result).toContain('PDF')
    })

    test('renders the document type select with both options', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="document-type-input"')
      expect(result).toContain('Sampling and inspection plan')
      expect(result).toContain('Supporting evidence')
    })

    test('renders a non-blank default option for the document type select', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        '<option value="">Select a document type</option>'
      )
    })

    test('continue form posts to the results endpoint', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `action="/accreditation/sampling-plan/${APPLICATION_ID}/results"`
      )
      expect(result).toContain('data-testid="continue-form"')
    })

    test('never renders a files table on the upload page', async () => {
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

      expect(result).not.toContain('data-testid="uploaded-files-table"')
    })

    test('does not show the view-uploaded-files link when no files uploaded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).not.toContain('data-testid="view-uploaded-files-link"')
    })

    test('shows a view-uploaded-files link with a count when files exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile(), makeFile({ fileId: 'file-002' })]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(result).toContain('data-testid="view-uploaded-files-link"')
      expect(result).toContain(
        `href="/accreditation/sampling-plan/${APPLICATION_ID}/results"`
      )
      expect(result).toContain('2')
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

    test('redirects to query-task-list when application is Queried and sampling plan section is not', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          samplingPlan: { sectionStatus: 'Completed', files: [] }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })

    test('renders the form and query note when sampling plan section itself is Queried', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          samplingPlan: { sectionStatus: 'Queried', files: [] },
          query: { queryNote: 'Please resubmit the sampling schedule.' }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Please resubmit the sampling schedule.')
    })

    test('returns 200 in Welsh locale', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/cy/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('[Welsh] Upload sampling and inspection plan')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId} — uploadFile', () => {
    const boundary = 'test-boundary-abc123'
    const multipartContentType = `multipart/form-data; boundary=${boundary}`

    function buildMultipartPayload({
      filename = 'test.png',
      contentType = 'image/png',
      fileBytes = Buffer.from('fake-content'),
      documentType = 'SamplingPlan'
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

      if (documentType !== '') {
        buffers.push(
          Buffer.from(
            `--${boundary}${CRLF}` +
              `Content-Disposition: form-data; name="documentType"${CRLF}` +
              CRLF +
              `${documentType}${CRLF}`
          )
        )
      }

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
    })

    test('CDP redirect response (opaqueredirect) is treated as a successful upload', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        type: 'opaqueredirect'
      })

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
    })

    test('literal 3xx response with a non-opaque type (CDP proxy) is treated as a successful upload', async () => {
      // Regression guard: when routed through CDP's outbound proxy, fetch's
      // manual-redirect-to-opaque-response conversion doesn't reliably happen, so the
      // real 302/type 'basic' comes through instead of type 'opaqueredirect'. This
      // must still be treated as success, not a failure.
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        type: 'basic'
      })

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
    })

    test('genuine CDP proxy failure still returns 500 with uploadError', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        type: 'basic'
      })

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'sampling-plan.png',
          contentType: 'image/png'
        })
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('problem uploading your file')
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

    test('missing document type returns 400 with noDocumentType error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'sampling-plan.png',
          contentType: 'image/png',
          documentType: ''
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="document-type-error"')
      expect(result).toContain('Select a document type')
    })

    test('unrecognised document type returns 400 with noDocumentType error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'sampling-plan.png',
          contentType: 'image/png',
          documentType: 'NotARealType'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="document-type-error"')
    })

    test('missing document type and invalid file both render their errors together', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({ filename: '', documentType: '' })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="document-type-error"')
      expect(result).toContain('data-testid="file-error"')
    })

    test('re-renders with the chosen document type still selected when only the file fails validation', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'malware.exe',
          contentType: 'application/octet-stream',
          documentType: 'SupportingEvidence'
        })
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('value="SupportingEvidence" selected')
    })

    test('CDP redirect response from proxy upload is treated as success, not failure', async () => {
      // Regression guard: cdp-uploader's /upload-and-scan responds with a redirect meant for
      // an end-user's browser, not our server-to-server proxy fetch. Previously this was
      // treated as a failure (since a 3xx isn't `ok`), causing every real upload to 500 and
      // never reach the status page at all.
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        type: 'opaqueredirect'
      })

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
        expect.any(String),
        expect.objectContaining({ redirect: 'manual' })
      )
    })

    test('genuine non-2xx/3xx proxy response still returns 500 with uploadError', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildMultipartPayload({
          filename: 'sampling-plan.png',
          contentType: 'image/png'
        })
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="file-error"')
      expect(result).toContain('problem uploading your file')
    })

    test('initUpload failure returns 500 with uploadError', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      vi.mocked(initUpload).mockRejectedValueOnce(new Error('CDP unavailable'))

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
        payload: {}
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('GET /accreditation/sampling-plan/{applicationId}/status', () => {
    const boundary = 'test-boundary-status'
    const multipartContentType = `multipart/form-data; boundary=${boundary}`

    function buildFilePayload(documentType = 'SamplingPlan') {
      const CRLF = '\r\n'
      return Buffer.concat([
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="action"${CRLF}${CRLF}uploadFile${CRLF}`
        ),
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="documentType"${CRLF}${CRLF}${documentType}${CRLF}`
        ),
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename="plan.pdf"${CRLF}` +
            `Content-Type: application/pdf${CRLF}${CRLF}`
        ),
        Buffer.from('file-content'),
        Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
      ])
    }

    async function getStatusCookie(documentType = 'SamplingPlan') {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const postResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildFilePayload(documentType)
      })
      const raw = postResponse.headers['set-cookie']
      return Array.isArray(raw) ? raw[0].split(';')[0] : raw.split(';')[0]
    }

    test('returns polling view when upload is preprocessing', async () => {
      const cookie = await getStatusCookie()
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'pending',
        processingStatus: 'preprocessing'
      })

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="status-message"')
      expect(result).toContain('Your file is being virus checked')
      expect(result).toContain('This may take a few minutes.')
      expect(result).toContain('Keep this page open and do not refresh it.')
    })

    test('saves Clean scanStatus and redirects to the results page', async () => {
      const cookie = await getStatusCookie()
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        form: {
          file: {
            filename: 'plan.pdf',
            contentType: 'application/pdf',
            fileId: 'file-validated',
            fileStatus: 'complete'
          }
        }
      })
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          scanStatus: 'Clean',
          documentType: 'SamplingPlan'
        })
      )
    })

    test('threads the selected SupportingEvidence document type through to addFile', async () => {
      const cookie = await getStatusCookie('SupportingEvidence')
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        form: {
          file: {
            filename: 'evidence.pdf',
            contentType: 'application/pdf',
            fileId: 'file-validated',
            fileStatus: 'complete'
          }
        }
      })
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ documentType: 'SupportingEvidence' })
      )
    })

    test('saves Infected scanStatus and redirects to results with the shared failure flag', async () => {
      const cookie = await getStatusCookie()
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        form: {
          file: {
            filename: 'virus.pdf',
            contentType: 'application/pdf',
            fileId: 'file-rejected',
            fileStatus: 'rejected'
          }
        }
      })
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results?upload=failed`
      )
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ scanStatus: 'Infected' })
      )
    })

    test('redirects to results with the shared failure flag when CDP reports a form error, without saving a file', async () => {
      const cookie = await getStatusCookie()
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        processingStatus: 'preprocessing',
        form: {
          file: {
            hasError: true
          }
        }
      })
      const postSpy = vi.spyOn(apiClient, 'post')

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results?upload=failed`
      )
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('redirects to results with the shared failure flag when addFile rejects, instead of a silent success redirect', async () => {
      const cookie = await getStatusCookie()
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        form: {
          file: {
            filename: 'plan.pdf',
            contentType: 'application/pdf',
            fileId: 'file-validated',
            fileStatus: 'complete'
          }
        }
      })
      vi.spyOn(apiClient, 'post').mockRejectedValue(
        new Error('Backend rejected the request')
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results?upload=failed`
      )
    })
  })

  describe('uploading multiple files via the "Upload another file" loop', () => {
    const boundary = 'test-boundary-loop'
    const multipartContentType = `multipart/form-data; boundary=${boundary}`

    function buildFilePayload(filename, documentType = 'SamplingPlan') {
      const CRLF = '\r\n'
      return Buffer.concat([
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="action"${CRLF}${CRLF}uploadFile${CRLF}`
        ),
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="documentType"${CRLF}${CRLF}${documentType}${CRLF}`
        ),
        Buffer.from(
          `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
            `Content-Type: application/pdf${CRLF}${CRLF}`
        ),
        Buffer.from('file-content'),
        Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
      ])
    }

    async function uploadOneFile({
      currentFiles,
      filename,
      fileId,
      documentType = 'SamplingPlan'
    }) {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: { sectionStatus: 'InProgress', files: currentFiles }
        })
      )
      const uploadResponse = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}`,
        headers: { ...operatorHeaders, 'Content-Type': multipartContentType },
        payload: buildFilePayload(filename, documentType)
      })
      const raw = uploadResponse.headers['set-cookie']
      const cookie = Array.isArray(raw)
        ? raw[0].split(';')[0]
        : raw.split(';')[0]

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        uploadStatus: 'ready',
        form: {
          file: {
            filename,
            contentType: 'application/pdf',
            fileId,
            fileStatus: 'complete'
          }
        }
      })
      const addFileSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})

      const statusResponse = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/status`,
        headers: { ...operatorHeaders, Cookie: cookie }
      })

      return { statusResponse, addFileSpy }
    }

    test('lets a second file be uploaded from the results page without losing the first', async () => {
      const first = await uploadOneFile({
        currentFiles: [],
        filename: 'first.pdf',
        fileId: 'file-first'
      })
      expect(first.statusResponse.headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results`
      )
      expect(first.addFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ filename: 'first.pdf' })
      )

      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ fileId: 'file-first', filename: 'first.pdf' })]
          }
        })
      )
      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('first.pdf')
      expect(result).toContain(
        `href="/accreditation/sampling-plan/${APPLICATION_ID}"`
      )

      const second = await uploadOneFile({
        currentFiles: [
          makeFile({ fileId: 'file-first', filename: 'first.pdf' })
        ],
        filename: 'second.pdf',
        fileId: 'file-second'
      })
      expect(second.statusResponse.headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results`
      )
      expect(second.addFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ filename: 'second.pdf' })
      )

      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [
              makeFile({ fileId: 'file-first', filename: 'first.pdf' }),
              makeFile({ fileId: 'file-second', filename: 'second.pdf' })
            ]
          }
        })
      )
      const finalResults = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })
      expect(finalResults.result).toContain('first.pdf')
      expect(finalResults.result).toContain('second.pdf')
    })

    test('a second upload with a different document type does not leak the first session value', async () => {
      const first = await uploadOneFile({
        currentFiles: [],
        filename: 'first.pdf',
        fileId: 'file-first',
        documentType: 'SamplingPlan'
      })
      expect(first.addFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ documentType: 'SamplingPlan' })
      )

      const second = await uploadOneFile({
        currentFiles: [
          makeFile({ fileId: 'file-first', filename: 'first.pdf' })
        ],
        filename: 'second.pdf',
        fileId: 'file-second',
        documentType: 'SupportingEvidence'
      })
      expect(second.addFileSpy).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({ documentType: 'SupportingEvidence' })
      )
    })
  })

  describe('GET /accreditation/sampling-plan/{applicationId}/results', () => {
    test('redirects to the upload page when there are no files and no failure flag', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}`
      )
    })

    test('renders the results page listing uploaded files without a Status column', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ scanStatus: 'Clean' })]
          }
        })
      )

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="uploaded-files-table"')
      expect(result).toContain('sampling-plan.pdf')
      expect(result).not.toContain('data-testid="file-scan-status"')
      expect(result).not.toContain('govuk-tag--green')
      expect(result).not.toContain('govuk-tag--red')
      expect(result).not.toContain('data-testid="file-uploaded-by"')
      expect(result).toContain('data-testid="file-document-type"')
      expect(result).toContain('Sampling and inspection plan')
    })

    test('renders the Supporting evidence label for a SupportingEvidence file', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ documentType: 'SupportingEvidence' })]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(result).toContain('Supporting evidence')
    })

    test('renders the notSpecified fallback for a legacy file with no document type', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ documentType: undefined })]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(result).toContain('Not specified')
    })

    test('excludes Infected files from the results table', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [
              makeFile({
                fileId: 'file-clean',
                filename: 'clean.pdf',
                scanStatus: 'Clean'
              }),
              makeFile({
                fileId: 'file-infected',
                filename: 'infected.pdf',
                scanStatus: 'Infected'
              })
            ]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(result).toContain('clean.pdf')
      expect(result).not.toContain('infected.pdf')
    })

    test('shows an error banner when redirected here after a failed upload/virus check, even with no files', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results?upload=failed`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('problem uploading your file')
    })

    test('shows the same error message for a failed upload as for a failed virus check', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          samplingPlan: {
            sectionStatus: 'InProgress',
            files: [makeFile({ scanStatus: 'Infected' })]
          }
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results?upload=failed`,
        headers: operatorHeaders
      })

      expect(result).toContain('problem uploading your file')
    })

    test('upload-another-file link points to the upload page', async () => {
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(result).toContain(
        `href="/accreditation/sampling-plan/${APPLICATION_ID}"`
      )
    })

    test('returns 500 with error when API fetch fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })

    test('redirects to query-task-list when application is Queried and sampling plan section is not', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          samplingPlan: { sectionStatus: 'Completed', files: [makeFile()] }
        })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId}/results — saveAndContinue', () => {
    test('redirects to query-task-list when application is Queried and sampling plan section is not, without patching', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeApplication({
          applicationStatus: 'Queried',
          samplingPlan: { sectionStatus: 'Completed', files: [] }
        })
      )
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/query-task-list/${APPLICATION_ID}`
      )
      expect(patchSpy).not.toHaveBeenCalled()
    })

    test('returns 400 with error when no files uploaded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())

      const { result, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId}/results — saveAndComeLater', () => {
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'saveAndComeLater' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId}/results — deleteFile', () => {
    test('calls delete and redirects back to the results page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeApplication())
      const deleteSpy = vi
        .spyOn(apiClient, 'delete')
        .mockResolvedValue(undefined)

      const { headers, statusCode } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'deleteFile', fileId: 'file-001' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(
        `/accreditation/sampling-plan/${APPLICATION_ID}/results`
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
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
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'deleteFile' }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(deleteSpy).not.toHaveBeenCalled()
    })
  })

  describe('POST /accreditation/sampling-plan/{applicationId}/results — GET fetch failure', () => {
    test('returns 500 when initial GET fails on any POST', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('API down'))

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `/accreditation/sampling-plan/${APPLICATION_ID}/results`,
        headers: operatorHeaders,
        payload: { action: 'saveAndContinue' }
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-summary"')
    })
  })
})
