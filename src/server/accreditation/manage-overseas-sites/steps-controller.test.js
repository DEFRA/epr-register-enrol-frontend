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
import { setFeatureFlag } from '../../common/test-helpers/feature-flags.js'
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
  organisationId: '50018',
  registrationId: 'aaa000000000000000050018',
  registrationReference: 'R26EX0500180001PL',
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
    setFeatureFlag('inYearChangesEnabled', true)
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

  // The status page reads the change view (its draft site) and the upload
  // status, both through apiClient.get.
  function mockStatusGets(uploadStatus, changeView = view) {
    return vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (url) =>
        url.startsWith('/api/v1/accreditation-changes/')
          ? changeView
          : uploadStatus
      )
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

  test('an upload without a valid-to date has no expiry', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.mocked(initUpload).mockResolvedValue({ fileUploadId: 'up-2' })
    const { statusCode } = await postUpload({
      action: 'uploadFile',
      validFromDay: '1',
      validFromMonth: '11',
      validFromYear: '2026'
    })
    expect(statusCode).toBe(statusCodes.redirect)
    expect(initUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ besEvidenceExpiryDate: null })
      })
    )
  })

  test.each([
    [
      'a file type that is not allowed',
      dates,
      'bes.exe',
      'data-testid="file-error"'
    ],
    [
      'a valid-to date before valid-from',
      { ...dates, validToYear: '2025' },
      'bes.pdf',
      'data-testid="valid-to-error"'
    ]
  ])('rejects %s', async (_name, fields, file, marker) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const { statusCode, result } = await postUpload(fields, file)
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain(marker)
    expect(initUpload).not.toHaveBeenCalled()
  })

  test('a backend failure saving an answer is not hidden', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      Object.assign(new Error('500'), { status: 500 })
    )
    const { statusCode } = await server.inject({
      method: 'POST',
      url: `${SITE}/conditions-of-export`,
      payload: { conditionsOfExport: 'yes' }
    })
    expect(statusCode).toBe(statusCodes.internalServerError)
  })

  test('recycling operation: choosing none is rejected without saving', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const patch = vi.spyOn(apiClient, 'patch')
    const { statusCode } = await server.inject({
      method: 'POST',
      url: `${SITE}/recycling-operation`,
      payload: {}
    })
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(patch).not.toHaveBeenCalled()
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
    mockStatusGets({ uploadStatus: 'pending' })
    const pending = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(pending.statusCode).toBe(statusCodes.ok)

    mockStatusGets({
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
    mockStatusGets({
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
    mockStatusGets({ uploadStatus: 'ready', form: {} })
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      Object.assign(new Error('422'), { status: 422 })
    )
    const { headers } = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(SITE)
  })

  // RA-605's 10-file cap, applied to the change request's site.
  function viewWithUploads(scanStatuses) {
    const [requestSite] = view.activeRequest.sites
    return {
      ...view,
      activeRequest: {
        ...view.activeRequest,
        sites: [
          {
            ...requestSite,
            besEvidence: {
              besEvidenceUploads: scanStatuses.map((scanStatus, i) => ({
                fileId: `f${i}`,
                filename: `bes-${i}.pdf`,
                scanStatus
              }))
            }
          }
        ]
      }
    }
  }

  test('a site that already has 10 files is refused before uploading', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      viewWithUploads(Array(10).fill('Clean'))
    )
    const { statusCode, result } = await postUpload()
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain(
      'You can only upload a maximum of 10 files as evidence of broadly equivalent standards.'
    )
    expect(initUpload).not.toHaveBeenCalled()
  })

  test('an infected file does not count towards the cap, so a site under it can upload', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(
      viewWithUploads([...Array(9).fill('Clean'), 'Infected'])
    )
    vi.mocked(initUpload).mockResolvedValue({
      fileUploadId: 'up-1',
      uploadUrl: 'http://cdp/upload',
      statusUrl:
        'http://backend/api/v1/accreditation-applications/o/a/files/up-1/status'
    })
    const { headers } = await postUpload()
    expect(headers.location).toBe(`${SITE}/bes-evidence/status`)
    expect(initUpload).toHaveBeenCalled()
  })

  test("status: the backend's max-files 422 shows the cap's message on the upload page", async () => {
    const { cookie } = await uploadCookie()
    mockStatusGets({ uploadStatus: 'ready', form: {} })
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      Object.assign(new Error('422'), {
        status: 422,
        response: JSON.stringify({ code: 'MaxFilesExceeded' })
      })
    )
    const { headers } = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(`${SITE}/bes-evidence?reason=maxFiles`)

    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    const page = await server.inject(headers.location)
    expect(page.statusCode).toBe(statusCodes.ok)
    expect(page.result).toContain(
      'You can only upload a maximum of 10 files as evidence of broadly equivalent standards.'
    )
  })

  test('status: with no upload in the session, nothing is attached and the operator goes back to the upload page', async () => {
    const get = vi.spyOn(apiClient, 'get')
    const post = vi.spyOn(apiClient, 'post')
    const { headers } = await server.inject(`${SITE}/bes-evidence/status`)
    expect(headers.location).toBe(`${SITE}/bes-evidence`)
    expect(get).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  test('status: an upload started for another site is not attached to this one', async () => {
    const { cookie } = await uploadCookie()
    const otherSite = SITE.replace('/add/900183', '/add/900184')
    const post = vi.spyOn(apiClient, 'post')
    const { headers } = await server.inject({
      url: `${otherSite}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(`${otherSite}/bes-evidence`)
    expect(post).not.toHaveBeenCalled()
  })

  test('status: a site no longer in the draft is not attached, and goes back to the list', async () => {
    const { cookie } = await uploadCookie()
    mockStatusGets(
      { uploadStatus: 'ready', form: { file: { filename: 'bes.pdf' } } },
      { ...view, activeRequest: null }
    )
    const post = vi.spyOn(apiClient, 'post')
    const { headers } = await server.inject({
      url: `${SITE}/bes-evidence/status`,
      headers: { Cookie: cookie }
    })
    expect(headers.location).toBe(
      '/manage/50018/R26EX0500180001PL/Plastic/overseas-sites'
    )
    expect(post).not.toHaveBeenCalled()
  })

  test.each([
    `/accreditation/manage-overseas-sites/${APP}/add/not-a-number`,
    `/accreditation/manage-overseas-sites/${APP}/add/0/location`
  ])('%s is a bad request', async (url) => {
    const get = vi.spyOn(apiClient, 'get')
    const { statusCode } = await server.inject(url)
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(get).not.toHaveBeenCalled()
  })

  test('a step for a site that is not in the draft goes back to the list', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...view,
      activeRequest: null
    })
    const { headers } = await server.inject(`${SITE}/location`)
    expect(headers.location).toBe(
      '/manage/50018/R26EX0500180001PL/Plastic/overseas-sites'
    )
  })

  test('location: a site with neither value asks for both', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...view,
      sites: [{ ...view.sites[0], lockedFields: [] }],
      activeRequest: {
        sites: [{ ...view.activeRequest.sites[0], effective: {} }]
      }
    })
    const { result } = await server.inject(`${SITE}/location`)
    expect(result).toContain('data-testid="country-input"')
    expect(result).toContain('data-testid="coordinates-input"')
  })

  test('location: a refusal that names no field is shown against the first one', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      Object.assign(new Error('400'), { status: 400, response: '{}' })
    )
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: `${SITE}/location`,
      payload: { coordinates: '19.076000, 72.877700' }
    })
    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain(
      'This information could not be saved. Check it and try again.'
    )
  })

  test('location: a field the backend rejects is shown against that field', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(view)
    vi.spyOn(apiClient, 'patch').mockRejectedValue(
      Object.assign(new Error('400'), {
        status: 400,
        response: JSON.stringify({
          errors: { coordinates: ['Coordinates are locked'] }
        })
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
