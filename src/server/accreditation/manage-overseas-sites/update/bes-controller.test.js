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
import { apiClient } from '../../../common/api-client.js'
import { setFeatureFlag } from '../../../common/test-helpers/feature-flags.js'
import { initUpload } from '../../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../../common/helpers/upload/proxy-upload-to-cdp.js'

vi.mock('../../../common/helpers/upload/init-upload.js', () => ({
  initUpload: vi.fn()
}))
vi.mock('../../../common/helpers/upload/proxy-upload-to-cdp.js', () => ({
  proxyUploadToCdp: vi.fn()
}))

const APP = 'a26000000000000000050025'
const UPDATE = `/accreditation/manage-overseas-sites/${APP}/update/902501`
const UPLOAD = `${UPDATE}/bes-evidence`
const STATUS = `${UPLOAD}/status`

const SITE = {
  siteId: 902501,
  orsId: '001',
  siteName: 'Ho Chi Minh Recycling',
  addressLine1: '1 River Road',
  townOrCity: 'Port',
  country: 'Vietnam',
  isEu: false,
  isOecd: false,
  conditionsOfExport: false,
  besEvidence: { besEvidenceUploads: [{ fileId: 'f1', filename: 'held.pdf' }] }
}

const DETAILS = {
  siteName: SITE.siteName,
  addressLine1: SITE.addressLine1,
  addressLine2: null,
  townOrCity: SITE.townOrCity,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  repatriatedLoads: null
}

function updateItem(uploads = []) {
  return {
    siteId: 902501,
    orsId: '001',
    changeType: 'update-overseas-site',
    previous: DETAILS,
    proposed: DETAILS,
    interimSiteChanges: [],
    besEvidence: { besEvidenceUploads: uploads },
    missingFields: [],
    status: 'InProgress'
  }
}

function makeView({ item = null, pending = null, site = SITE } = {}) {
  const activeRequest = item
    ? { requestId: 'req-1', status: 'InProgress', sites: [item] }
    : null
  return {
    organisationId: '50025',
    applicationId: APP,
    registrationReference: 'R26EX0500250001ST',
    materialType: 'Steel',
    sites: [
      {
        siteId: 902501,
        orsId: '001',
        accreditationStatus: 'Accredited',
        pendingRequestStatus: pending ?? (item ? 'InProgress' : null),
        lockedFields: [],
        site
      }
    ],
    activeRequest,
    requests: activeRequest ? [activeRequest] : []
  }
}

function apiError(status, response) {
  return Object.assign(new Error(`HTTP ${status}`), { status, response })
}

const boundary = 'ra682-boundary'
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

const DATES = {
  action: 'uploadFile',
  validFromDay: '1',
  validFromMonth: '11',
  validFromYear: '2026',
  validToDay: '30',
  validToMonth: '11',
  validToYear: '2027'
}

describe('#updateOverseasSite BES evidence (RA-682)', () => {
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

  function postUpload(fields = DATES, file = 'new.pdf') {
    return server.inject({
      method: 'POST',
      url: UPLOAD,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      payload: multipart(fields, file)
    })
  }

  function mockStatusGets(uploadStatus, changeView = makeView()) {
    return vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (url) =>
        url.startsWith('/api/v1/accreditation-changes/')
          ? changeView
          : uploadStatus
      )
  }

  async function uploadCookie(view = makeView()) {
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

  describe('the details page', () => {
    test("offers an upload, and a Delete for the update's files only", async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeView({ item: updateItem([{ fileId: 'f2', filename: 'new.pdf' }]) })
      )
      const { result } = await server.inject(UPDATE)
      expect(result).toContain(
        `href="${UPLOAD}" data-testid="row-bes-evidence-action">Upload`
      )
      expect(result).toContain('data-testid="filename-f1">held.pdf')
      expect(result).not.toContain('data-testid="delete-file-button-f1"')
      expect(result).toContain(`action="${UPLOAD}/f2/delete"`)
      expect(result).toContain('data-testid="delete-file-button-f2"')
    })

    test('shows conditions of export for steel', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { result } = await server.inject(UPDATE)
      expect(result).toContain('data-testid="row-conditions-of-export-value"')
    })

    test('a pending ORS has no upload or Delete', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeView({
          item: updateItem([{ fileId: 'f2', filename: 'new.pdf' }]),
          pending: 'Submitted'
        })
      )
      const { result } = await server.inject(UPDATE)
      expect(result).not.toContain('data-testid="row-bes-evidence-action"')
      expect(result).not.toContain('data-testid="delete-file-button-f2"')
    })

    test('an ORS that needs no BES evidence has no upload', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeView({ site: { ...SITE, isOecd: true } })
      )
      const { result } = await server.inject(UPDATE)
      expect(result).not.toContain('data-testid="row-bes-evidence-action"')
      const { headers } = await server.inject(UPLOAD)
      expect(headers.location).toBe(UPDATE)
    })

    test('the success banner names the evidence', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { result } = await server.inject(`${UPDATE}?updated=bes-evidence`)
      expect(result).toContain(
        'Evidence of broadly equivalent standards updated.'
      )
    })
  })

  describe('the upload page', () => {
    test('shows the upload form, back to the details page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { statusCode, result } = await server.inject(UPLOAD)
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Ho Chi Minh Recycling')
      expect(result).toContain(`href="${UPDATE}"`)
    })

    test('a pending ORS goes back to its details', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeView({ item: updateItem(), pending: 'Submitted' })
      )
      const { headers } = await server.inject(UPLOAD)
      expect(headers.location).toBe(UPDATE)
    })

    test('uploads through the change request, then checks its status', async () => {
      const { response } = await uploadCookie()
      expect(response.headers.location).toBe(STATUS)
      expect(initUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          initiateUrl: expect.stringMatching(
            /requests\/current\/bes-evidence\/initiate$/
          ),
          redirectUrl: expect.stringMatching(
            /\/update\/902501\/bes-evidence\/status$/
          )
        })
      )
      expect(proxyUploadToCdp).toHaveBeenCalled()
    })

    test('save and come back later returns to the details', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { headers } = await postUpload({ action: 'saveAndComeLater' }, null)
      expect(headers.location).toBe(UPDATE)
    })

    test('a missing file is refused and nothing is uploaded', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { statusCode } = await postUpload(DATES, null)
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(initUpload).not.toHaveBeenCalled()
    })

    test('a file named as one the ORS holds is refused', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { statusCode } = await postUpload(DATES, 'held.pdf')
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(initUpload).not.toHaveBeenCalled()
    })

    test('a failed upload shows the upload error', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      vi.mocked(initUpload).mockRejectedValue(new Error('down'))
      const { statusCode } = await postUpload()
      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('the status page', () => {
    test('with no upload in this session goes back to the upload page', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(makeView())
      const { headers } = await server.inject(STATUS)
      expect(headers.location).toBe(UPLOAD)
    })

    test('polls until ready, then starts the update and adds the file to it', async () => {
      const { cookie } = await uploadCookie()
      mockStatusGets({ uploadStatus: 'pending' })
      const pending = await server.inject({
        url: STATUS,
        headers: { Cookie: cookie }
      })
      expect(pending.result).toContain('http-equiv="refresh"')

      mockStatusGets({ uploadStatus: 'ready', form: {} })
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const { headers } = await server.inject({
        url: STATUS,
        headers: { Cookie: cookie }
      })
      expect(post).toHaveBeenCalledWith(
        expect.stringMatching(/requests\/current\/sites$/),
        expect.objectContaining({ changeType: 'update-overseas-site' })
      )
      expect(post).toHaveBeenLastCalledWith(
        expect.stringMatching(/sites\/902501\/bes-evidence\/files$/),
        expect.objectContaining({ fileUploadId: 'up-1' })
      )
      expect(headers.location).toBe(`${UPDATE}?updated=bes-evidence`)
    })

    test("the backend's max-files 422 shows on the upload page", async () => {
      const item = updateItem()
      const { cookie } = await uploadCookie(makeView({ item }))
      mockStatusGets({ uploadStatus: 'ready', form: {} }, makeView({ item }))
      vi.spyOn(apiClient, 'post').mockRejectedValue(
        apiError(422, JSON.stringify({ code: 'MaxFilesExceeded' }))
      )
      const { headers } = await server.inject({
        url: STATUS,
        headers: { Cookie: cookie }
      })
      expect(headers.location).toBe(`${UPLOAD}?reason=maxFiles`)
    })

    test("a conflict shows the backend's message on the details page", async () => {
      const item = updateItem()
      const { cookie } = await uploadCookie(makeView({ item }))
      mockStatusGets({ uploadStatus: 'ready', form: {} }, makeView({ item }))
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(409, 'not json'))
      const { statusCode, result } = await server.inject({
        url: STATUS,
        headers: { Cookie: cookie }
      })
      expect(statusCode).toBe(statusCodes.conflict)
      expect(result).toContain('data-testid="error-message"')
    })

    test('an ORS that has gone goes back to its details', async () => {
      const item = updateItem()
      const { cookie } = await uploadCookie(makeView({ item }))
      mockStatusGets({ uploadStatus: 'ready', form: {} }, makeView({ item }))
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        url: STATUS,
        headers: { Cookie: cookie }
      })
      expect(headers.location).toBe(UPDATE)
    })
  })

  describe('removing a file', () => {
    function remove() {
      return server.inject({ method: 'POST', url: `${UPLOAD}/f2/delete` })
    }

    beforeEach(() => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        makeView({ item: updateItem([{ fileId: 'f2', filename: 'new.pdf' }]) })
      )
    })

    test("deletes it from the update's evidence", async () => {
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
      const { headers } = await remove()
      expect(del).toHaveBeenCalledWith(
        expect.stringMatching(/sites\/902501\/bes-evidence\/files\/f2$/)
      )
      expect(headers.location).toBe(`${UPDATE}?updated=bes-evidence`)
    })

    test('one already gone still returns to the details', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(404))
      const { headers } = await remove()
      expect(headers.location).toBe(`${UPDATE}?updated=bes-evidence`)
    })

    test("a conflict shows the backend's message", async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(409, 'not json'))
      const { statusCode } = await remove()
      expect(statusCode).toBe(statusCodes.conflict)
    })

    test('any other failure shows the delete error', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(500))
      const { statusCode, result } = await remove()
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-message"')
    })
  })
})
