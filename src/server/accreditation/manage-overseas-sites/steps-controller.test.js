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
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../common/helpers/upload/proxy-upload-to-cdp.js'

vi.mock('../../common/helpers/upload/init-upload.js', () => ({
  initUpload: vi.fn()
}))
vi.mock('../../common/helpers/upload/proxy-upload-to-cdp.js', () => ({
  proxyUploadToCdp: vi.fn()
}))

const APP = 'a26000000000000000050018'
const SITE = `/accreditation/manage-overseas-sites/${APP}/add/900183`

const view = {
  materialType: 'Plastic',
  sites: [
    {
      siteId: 900183,
      orsId: '003',
      accreditationStatus: 'Registered',
      pendingRequestStatus: 'InProgress',
      lockedFields: ['country'],
      site: { siteName: 'India Site', country: 'India' }
    }
  ],
  activeRequest: {
    sites: [
      {
        siteId: 900183,
        orsId: '003',
        effective: { country: 'India' },
        besEvidenceRequired: true,
        missingFields: ['besEvidence']
      }
    ]
  }
}

const boundary = 'ra492-boundary'
const CRLF = '\r\n'

function multipart(fields, file) {
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`
  )
  if (file) {
    parts.push(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${file}"${CRLF}Content-Type: application/pdf${CRLF}${CRLF}content${CRLF}`
    )
  }
  return Buffer.from(`${parts.join('')}--${boundary}--${CRLF}`)
}

const dates = {
  action: 'uploadFile',
  validFromDay: '1',
  validFromMonth: '11',
  validFromYear: '2026',
  validToDay: '30',
  validToMonth: '11',
  validToYear: '2027'
}

describe('#manageOverseasSites BES evidence (RA-492)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(initUpload).mockReset()
    vi.mocked(proxyUploadToCdp).mockReset()
  })

  function postUpload(fields = dates, file = 'bes.pdf') {
    return server.inject({
      method: 'POST',
      url: `${SITE}/bes-evidence`,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      payload: multipart(fields, file)
    })
  }

  async function uploadCookie() {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.mocked(initUpload).mockResolvedValue({
      fileUploadId: 'up-1',
      uploadUrl: 'http://cdp/upload',
      statusUrl:
        'http://backend/api/v1/accreditation-applications/o/a/files/up-1/status'
    })
    const response = await postUpload()
    const raw = response.headers['set-cookie']
    return { response, cookie: [raw].flat()[0].split(';')[0] }
  }

  test('uploads to the request via the accreditation-changes initiate endpoint', async () => {
    const { response } = await uploadCookie()
    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe(`${SITE}/bes-evidence/status`)
    expect(initUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        initiateUrl: expect.stringMatching(
          new RegExp(
            `/accreditation-changes/[^/]+/${APP}/requests/current/bes-evidence/initiate$`
          )
        ),
        redirectUrl: expect.stringMatching(
          /\/add\/900183\/bes-evidence\/status$/
        )
      })
    )
    expect(proxyUploadToCdp).toHaveBeenCalled()
  })

  test('an upload failure stays on the page with an error', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.mocked(initUpload).mockRejectedValue(new Error('down'))
    const { statusCode, result } = await postUpload()
    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('data-testid="file-error"')
  })

  test('a missing valid-from date is rejected', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const { statusCode } = await postUpload({ action: 'uploadFile' })
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(initUpload).not.toHaveBeenCalled()
  })

  test('status: polls until ready, then adds the file to the request and returns to the summary', async () => {
    const { cookie } = await uploadCookie()
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      uploadStatus: 'pending',
      processingStatus: 'pending'
    })
    const pending = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(pending.statusCode).toBe(statusCodes.ok)

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      uploadStatus: 'ready',
      form: { file: { filename: 'bes.pdf' } }
    })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
    const ready = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/requests\/current\/sites\/900183\/bes-evidence\/files$/
      ),
      expect.objectContaining({ fileUploadId: 'up-1' })
    )
    expect(ready.headers.location).toBe(SITE)
  })

  test('status: a rejected file goes back to the upload page', async () => {
    const { cookie } = await uploadCookie()
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      uploadStatus: 'ready',
      form: { file: { hasError: true } }
    })
    const { headers } = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(`${SITE}/bes-evidence`)
  })

  test('status: a backend refusal still returns to the summary, which shows the evidence as missing', async () => {
    const { cookie } = await uploadCookie()
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      uploadStatus: 'ready',
      form: {}
    })
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      Object.assign(new Error('422'), { status: 422 })
    )
    const { headers } = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(SITE)
  })

  test('a step for a site that is not in the draft goes back to the list', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...view,
      activeRequest: null
    })
    const { headers } = await server.inject(`${SITE}/location`)
    expect(headers.location).toBe(`/accreditation/manage-overseas-sites/${APP}`)
  })

  test('location: a field the backend rejects is shown against that field', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      Object.assign(new Error('400'), {
        status: 400,
        response: { errors: { coordinates: ['Coordinates are locked'] } }
      })
    )
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `${SITE}/location`,
      payload: { coordinates: '19.076000, 72.877700' }
    })
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain('Coordinates are locked')
  })

  test('recycling operation: renders the add-overseas-site page for an unlocked site', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const { statusCode, result } = await server.inject(
      `${SITE}/recycling-operation`
    )
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(`href="${SITE}"`)
  })

  test('recycling operation: a valid choice is saved to the request', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
    const { headers } = await server.inject({
      method: 'POST',
      url: `${SITE}/recycling-operation`,
      payload: { recyclingOperationCodes: 'R3' }
    })
    expect(patch).toHaveBeenCalledWith(expect.any(String), {
      operationCodes: ['R3']
    })
    expect(headers.location).toBe(SITE)
  })
})
