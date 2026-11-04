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

const APP = 'a26000000000000000050018'
const BASE = `/accreditation/manage-overseas-sites/${APP}`

function siteEntry(overrides = {}) {
  return {
    siteId: 900182,
    orsId: '002',
    accreditationStatus: 'Registered',
    pendingRequestStatus: null,
    lockedFields: ['country', 'coordinates', 'operationCodes'],
    site: {
      siteId: 900182,
      orsId: '002',
      siteName: 'Denmark PR',
      siteAddress: 'Ejbyvvej',
      country: 'Denmark',
      coordinates: '55.1, 10.2',
      operationCodes: ['R3'],
      contactName: 'John Smith',
      contactEmail: 'john@example.com',
      contactPhone: '+45 1234',
      code1: 'B3011',
      repatriatedLoads: 'Returned'
    },
    ...overrides
  }
}

function requestSite(overrides = {}) {
  return {
    siteId: 900182,
    orsId: '002',
    siteName: 'Denmark PR',
    answers: {},
    effective: {
      country: 'Denmark',
      coordinates: '55.1, 10.2',
      operationCodes: ['R3'],
      conditionsOfExport: null
    },
    besEvidenceRequired: true,
    besEvidence: null,
    missingFields: ['conditionsOfExport', 'besEvidence'],
    isComplete: false,
    ...overrides
  }
}

// The backend's charge for n sites (pence).
function chargeOf(n) {
  return {
    chargeableSites: n,
    chargePerSitePence: 32800,
    totalPence: n * 32800
  }
}

function makeView({ sites, active, requests } = {}) {
  const activeRequest =
    active === null
      ? null
      : {
          requestId: 'req-1',
          status: 'InProgress',
          sites: active ?? [requestSite()],
          isComplete: (active ?? [requestSite()]).every((s) => s.isComplete),
          charge: chargeOf((active ?? [requestSite()]).length)
        }
  return {
    organisationId: '50018',
    applicationId: APP,
    registrationId: 'aaa000000000000000050018',
    materialType: 'Plastic',
    year: 2026,
    sites: sites ?? [
      siteEntry({
        siteId: 900181,
        orsId: '001',
        accreditationStatus: 'Accredited',
        site: { siteName: 'Rotterdam Recycling', country: 'Netherlands' }
      }),
      siteEntry({
        pendingRequestStatus: active === null ? null : 'InProgress'
      }),
      siteEntry({
        siteId: 900184,
        orsId: '004',
        lockedFields: ['country'],
        site: { siteName: 'Bergen factory', country: 'Norway' }
      })
    ],
    activeRequest,
    requests: requests ?? (activeRequest ? [activeRequest] : [])
  }
}

function mockGet(view, application = {}) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint) => {
    if (endpoint.startsWith('/api/v1/accreditation-changes/')) {
      return view
    }
    return {
      applicationId: APP,
      orgId: 50018,
      material: 'plastic',
      wasteProcessingType: 'exporter',
      applicationStatus: 'Approved',
      ...application
    }
  })
}

const WITH_FILE = {
  besEvidence: { besEvidenceUploads: [{ fileId: 'f1', filename: 'bes.pdf' }] }
}

function apiError(status, response) {
  return Object.assign(new Error(`HTTP ${status}`), { status, response })
}

describe('#manageOverseasSites (RA-492)', () => {
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
  })

  describe('Manage overseas reprocessing sites', () => {
    test('lists accredited and registered sites in tabs, with Add to accreditation on registered rows', async () => {
      mockGet(makeView({ active: null }))
      const { statusCode, result } = await server.inject(BASE)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Manage overseas reprocessing sites')
      expect(result).toContain('data-testid="tab-accredited"')
      expect(result).toContain('Accredited (1)')
      expect(result).toContain('Registered (2)')
      expect(result).toContain('data-testid="accredited-site-001"')
      expect(result).toContain('data-testid="registered-site-002"')
      expect(result).toContain(`action="${BASE}/sites/900182"`)
      expect(result).toContain('data-testid="add-to-accreditation-002"')
      expect(result).not.toContain('data-testid="requests-banner"')
      expect(result).not.toContain('data-testid="pending-change-banner"')
    })

    test('shows the requests banner and an In progress tag for a site in the draft (save and come back)', async () => {
      mockGet(makeView())
      const { result } = await server.inject(BASE)

      expect(result).toContain('data-testid="requests-banner"')
      expect(result).toContain(
        'You currently have 1 requests ready for submission.'
      )
      expect(result).toContain(`href="${BASE}/requests"`)
      expect(result).toContain('data-testid="site-status-tag-002"')
      expect(result).toContain('In progress')
      expect(result).toContain('data-testid="view-request-002"')
      expect(result).not.toContain('data-testid="add-to-accreditation-002"')
    })

    test('AC08/AC09: a submitted site shows Pending on the accredited list, no actions, and the pending banner', async () => {
      mockGet(
        makeView({
          active: null,
          sites: [
            siteEntry({ pendingRequestStatus: 'Submitted' }),
            siteEntry({ siteId: 900184, orsId: '004', lockedFields: [] })
          ]
        })
      )
      const { result } = await server.inject(BASE)

      expect(result).toContain('data-testid="pending-change-banner"')
      expect(result).toContain('data-testid="accredited-site-002"')
      expect(result).toContain('data-testid="site-status-tag-002"')
      expect(result).toContain('Pending')
      expect(result).not.toContain('data-testid="registered-site-002"')
      expect(result).not.toContain('data-testid="add-to-accreditation-002"')
      expect(result).toContain('data-testid="add-to-accreditation-004"')
    })

    test('a backend failure is not hidden', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(apiError(500))
      const { statusCode } = await server.inject(BASE)
      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('returns 404 when the application is not a granted exporter accreditation', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(apiError(409))
      const { statusCode } = await server.inject(BASE)
      expect(statusCode).toBe(statusCodes.notFound)
    })
  })

  describe('Add to accreditation', () => {
    test('AC01: POST adds the registered site to the draft and opens its summary', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/sites/900182`
      })

      expect(post).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `/accreditation-changes/[^/]+/${APP}/requests/current/sites$`
          )
        ),
        { siteId: 900182 }
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('AC09: a site the backend refuses (accredited or submitted) goes back to the list', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(409))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/sites/900182`
      })
      expect(headers.location).toBe(BASE)
    })

    test('summary: locked fields have no action, never-filled fields say Add information', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject(`${BASE}/add/900182`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Add to accreditation: Denmark PR (002)')
      for (const row of ['location', 'coordinates', 'recycling-operation']) {
        expect(result).toContain(`data-testid="row-${row}"`)
        expect(result).not.toContain(`data-testid="row-${row}-action"`)
      }
      for (const row of ['site-name', 'contact-name', 'basel-codes']) {
        expect(result).not.toContain(`data-testid="row-${row}-action"`)
      }
      expect(result).toContain('data-testid="row-conditions-of-export-missing"')
      expect(result).toMatch(
        /data-testid="row-conditions-of-export-action">Add information/
      )
      expect(result).toContain(`href="${BASE}/add/900182/conditions-of-export"`)
      expect(result).toMatch(
        /data-testid="row-bes-evidence-action">Add information/
      )
      expect(result).toContain('Ejbyvvej, Denmark')
    })

    test('a backend failure adding a site is not hidden', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(500))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${BASE}/sites/900182`
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('summary: each uploaded BES file is listed with a Delete button', async () => {
      mockGet(makeView({ active: [requestSite(WITH_FILE)] }))
      const { result } = await server.inject(`${BASE}/add/900182`)
      expect(result).toMatch(/data-testid="filename-f1">bes.pdf/)
      expect(result).toContain(
        `action="${BASE}/add/900182/bes-evidence/f1/delete"`
      )
      expect(result).toContain('data-testid="delete-file-button-f1"')
      expect(result).toMatch(/data-testid="row-bes-evidence-action">Change/)
    })

    test('removing a BES file deletes it from the request and returns to the summary', async () => {
      mockGet(makeView({ active: [requestSite(WITH_FILE)] }))
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence/f1/delete`
      })
      expect(del).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/requests\/current\/sites\/900182\/bes-evidence\/files\/f1$/
        )
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('removing a BES file that has already gone returns to the summary', async () => {
      mockGet(makeView({ active: [requestSite(WITH_FILE)] }))
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence/f1/delete`
      })
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('a failed BES file removal stays on the summary with the evidence page error', async () => {
      mockGet(makeView({ active: [requestSite(WITH_FILE)] }))
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(500))
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence/f1/delete`
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toContain('data-testid="error-bes-evidence"')
      expect(result).toContain(
        'Sorry, there was a problem deleting the file. Please try again.'
      )
      expect(result).toContain('data-testid="delete-file-button-f1"')
    })

    test('removing a BES file for a site not in the draft returns to the list', async () => {
      mockGet(makeView({ active: null }))
      const del = vi.spyOn(apiClient, 'delete')
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence/f1/delete`
      })
      expect(del).not.toHaveBeenCalled()
      expect(headers.location).toBe(BASE)
    })

    test('summary: a site without a country shows Missing information on the location row', async () => {
      const view = makeView({
        active: [requestSite({ effective: { country: null } })]
      })
      view.sites[1].lockedFields = []
      mockGet(view)
      const { result } = await server.inject(`${BASE}/add/900182`)
      expect(result).toContain('data-testid="row-location-missing"')
      expect(result).toMatch(
        /data-testid="row-location-action">Add information/
      )
    })

    test('summary: a field the operator filled in this request says Change', async () => {
      mockGet(
        makeView({
          active: [
            requestSite({
              answers: { conditionsOfExport: false },
              effective: {
                country: 'Denmark',
                coordinates: '55.1, 10.2',
                operationCodes: ['R3'],
                conditionsOfExport: false
              },
              besEvidenceRequired: false,
              missingFields: [],
              isComplete: true
            })
          ]
        })
      )
      const { result } = await server.inject(`${BASE}/add/900182`)

      expect(result).toMatch(
        /data-testid="row-conditions-of-export-action">Change/
      )
      expect(result).toMatch(
        /data-testid="row-conditions-of-export-value">\s*No\s*</
      )
      expect(result).not.toContain('data-testid="row-bes-evidence"')
    })

    test('AC02: Continue with missing information stays on the summary and identifies each field', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182`
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(result).toContain('data-testid="error-conditions-of-export"')
      expect(result).toContain('href="#row-conditions-of-export"')
      expect(result).toContain('data-testid="error-bes-evidence"')
      expect(result).toContain('data-testid="row-bes-evidence-error"')
      expect(result).toContain(
        'Add whether the site meets the conditions of export'
      )
    })

    test('Continue with complete information goes to the accreditation requests', async () => {
      mockGet(
        makeView({
          active: [requestSite({ missingFields: [], isComplete: true })]
        })
      )
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182`
      })
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`${BASE}/requests`)
    })

    test('AC09: the summary of a site not in the draft (e.g. submitted) redirects to the list', async () => {
      mockGet(
        makeView({
          active: null,
          sites: [siteEntry({ pendingRequestStatus: 'Submitted' })]
        })
      )
      const { statusCode, headers } = await server.inject(`${BASE}/add/900182`)
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(BASE)
    })

    test('Cancel of a site already gone from the draft still returns to the list', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/cancel`
      })
      expect(headers.location).toBe(BASE)
    })

    test('a backend failure on Cancel is not hidden', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(500))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/cancel`
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('Continue on a site not in the draft returns to the list', async () => {
      mockGet(makeView({ active: null }))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182`
      })
      expect(headers.location).toBe(BASE)
    })

    test('Cancel removes the site from the draft', async () => {
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/cancel`
      })
      expect(del).toHaveBeenCalledWith(
        expect.stringMatching(/\/requests\/current\/sites\/900182$/)
      )
      expect(headers.location).toBe(BASE)
    })
  })

  describe('Add information steps', () => {
    test('a locked step redirects to the summary', async () => {
      mockGet(makeView())
      const { statusCode, headers } = await server.inject(
        `${BASE}/add/900182/recycling-operation`
      )
      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('location shows a locked country as text and only patches coordinates', async () => {
      const view = makeView({
        active: [
          requestSite({
            siteId: 900184,
            orsId: '004',
            effective: { country: 'Norway' }
          })
        ]
      })
      view.sites[2].pendingRequestStatus = 'InProgress'
      mockGet(view)
      const page = await server.inject(`${BASE}/add/900184/location`)
      expect(page.result).toContain('data-testid="locked-country"')
      expect(page.result).not.toContain('data-testid="country-input"')
      expect(page.result).toContain('data-testid="coordinates-input"')

      const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900184/location`,
        payload: { country: 'France', coordinates: '59.913900, 10.752200' }
      })
      expect(patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/requests\/current\/sites\/900184$/),
        { coordinates: '59.913900, 10.752200' }
      )
      expect(headers.location).toBe(`${BASE}/add/900184`)
    })

    test('location validates coordinates with the add-overseas-site rules', async () => {
      const view = makeView({
        active: [requestSite({ siteId: 900184, orsId: '004' })]
      })
      mockGet(view)
      const patch = vi.spyOn(apiClient, 'patch')
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900184/location`,
        payload: { coordinates: '' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-summary"')
      expect(patch).not.toHaveBeenCalled()
    })

    test('conditions of export renders the add-overseas-site page and patches the answer', async () => {
      mockGet(makeView())
      const page = await server.inject(
        `${BASE}/add/900182/conditions-of-export`
      )
      expect(page.statusCode).toBe(statusCodes.ok)
      expect(page.result).toContain(`href="${BASE}/add/900182"`)

      const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/conditions-of-export`,
        payload: { conditionsOfExport: 'no' }
      })
      expect(patch).toHaveBeenCalledWith(expect.any(String), {
        conditionsOfExport: false
      })
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('conditions of export requires an answer', async () => {
      mockGet(makeView())
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/conditions-of-export`,
        payload: {}
      })
      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('conditions of export refused without a named field stays on the page with a general message', async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'patch').mockRejectedValue(
        apiError(400, JSON.stringify({ title: 'Bad request' }))
      )
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/conditions-of-export`,
        payload: { conditionsOfExport: 'yes' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain(
        'This information could not be saved. Check it and try again.'
      )
    })

    test('recycling operation shows the backend rejection on the page', async () => {
      const view = makeView({
        active: [requestSite({ siteId: 900184, orsId: '004' })]
      })
      mockGet(view)
      vi.spyOn(apiClient, 'patch').mockRejectedValue(
        apiError(
          400,
          JSON.stringify({ errors: { OperationCodes: ['Not allowed'] } })
        )
      )
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900184/recycling-operation`,
        payload: { recyclingOperationCodes: ['R3'] }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Not allowed')
    })

    test('BES evidence renders the upload page and save-and-come-back returns to the summary', async () => {
      mockGet(makeView())
      const page = await server.inject(`${BASE}/add/900182/bes-evidence`)
      expect(page.statusCode).toBe(statusCodes.ok)
      expect(page.result).toContain('data-testid="upload-form"')

      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence`,
        payload: { action: 'saveAndComeLater' }
      })
      expect(headers.location).toBe(`${BASE}/add/900182`)
    })

    test('BES evidence without a file is rejected', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/add/900182/bes-evidence`,
        payload: { action: 'uploadFile' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="file-error"')
    })
  })

  describe('Accreditation requests', () => {
    test('AC03/AC04/AC10: lists the draft sites, the per-ORS charge and total, and Add another request', async () => {
      mockGet(
        makeView({
          active: [
            requestSite({ isComplete: true }),
            requestSite({
              siteId: 900184,
              orsId: '004',
              siteName: 'Bergen factory',
              isComplete: true
            })
          ]
        })
      )
      const { statusCode, result } = await server.inject(`${BASE}/requests`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Accreditation requests')
      expect(result).toContain('data-testid="request-row-002"')
      expect(result).toContain('data-testid="request-row-004"')
      expect(result).toContain('New ORS')
      expect(result).toContain('Number of overseas reprocessing sites: 2')
      expect(result).toContain('£328.00')
      expect(result).toMatch(/data-testid="charge-total">£656.00/)
      expect(result).toContain(`href="${BASE}#registered"`)
      expect(result).toContain(`href="${BASE}/add/900184"`)
    })

    test('Continue with an incomplete site stays on the page and names it', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/requests`
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="error-request-002"')
      expect(result).toContain('Denmark PR (002) is missing information')
    })

    test('Continue with a complete request goes to the declaration', async () => {
      mockGet(makeView({ active: [requestSite({ isComplete: true })] }))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/requests`
      })
      expect(headers.location).toBe(`${BASE}/declaration`)
    })

    test('Continue with no draft returns to the list', async () => {
      mockGet(makeView({ active: null }))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/requests`
      })
      expect(headers.location).toBe(BASE)
    })

    test('with no draft there is nothing to continue', async () => {
      mockGet(makeView({ active: null }))
      const { result } = await server.inject(`${BASE}/requests`)
      expect(result).toContain('data-testid="no-requests"')
      expect(result).not.toContain('data-testid="continue-button"')
    })
  })

  describe('Declaration and payment', () => {
    test('AC05: the existing declaration page is shown for a complete request', async () => {
      mockGet(makeView({ active: [requestSite({ isComplete: true })] }))
      const { statusCode, result } = await server.inject(`${BASE}/declaration`)
      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="declaration-bullets"')
      expect(result).toContain('data-testid="full-name-input"')
    })

    test('the declaration is not reachable while the request is incomplete', async () => {
      mockGet(makeView())
      const { headers } = await server.inject(`${BASE}/declaration`)
      expect(headers.location).toBe(`${BASE}/requests`)
    })

    test('the declaration requires a name and job title', async () => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { submitAction: 'submit' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('data-testid="full-name-error"')
    })

    test('AC07: confirming submits the request and shows the payment page', async () => {
      mockGet(makeView())
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { fullName: 'Jane Smith', jobTitle: 'Director' }
      })
      expect(post).toHaveBeenCalledWith(
        expect.stringMatching(/\/requests\/current\/submit$/),
        expect.objectContaining({
          fullName: 'Jane Smith',
          jobTitle: 'Director',
          // The reference the payment page shows (England exporter, org 50018).
          paymentReference: 'PR/PK/EXP/50018'
        })
      )
      expect(headers.location).toBe(`${BASE}/payment`)
    })

    test('a submit with no draft (already submitted) returns to the list', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { fullName: 'Jane Smith', jobTitle: 'Director' }
      })
      expect(headers.location).toBe(BASE)
    })

    test('an incomplete request at submit goes back to the requests page', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(422))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { fullName: 'Jane Smith', jobTitle: 'Director' }
      })
      expect(headers.location).toBe(`${BASE}/requests`)
    })

    test('a failed submit keeps the operator on the declaration with an error', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(503))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { fullName: 'Jane Smith', jobTitle: 'Director' }
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('save and come back later returns to the manage page', async () => {
      const { headers } = await server.inject({
        method: 'POST',
        url: `${BASE}/declaration`,
        payload: { submitAction: 'saveAndComeLater' }
      })
      expect(headers.location).toBe(BASE)
    })

    test('AC03/AC04: the payment page charges £328 per submitted ORS and no tonnage fee', async () => {
      const submitted = {
        requestId: 'req-1',
        status: 'Submitted',
        submittedBy: { fullName: 'Jane Smith', email: 'jane@example.com' },
        sites: [requestSite(), requestSite({ siteId: 900184, orsId: '004' })],
        charge: chargeOf(2)
      }
      mockGet(makeView({ active: null, requests: [submitted] }))
      const { statusCode, result } = await server.inject(`${BASE}/payment`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(/data-testid="amount-due">\s*Amount due: £656.00/)
      expect(result).toContain('£656.00 for 2 Overseas Sites')
      expect(result).not.toMatch(/accreditation for Plastic/)
      expect(result).toContain('jane@example.com')
    })

    test('the payment page redirects when nothing has been submitted', async () => {
      mockGet(makeView())
      const { headers } = await server.inject(`${BASE}/payment`)
      expect(headers.location).toBe(BASE)
    })
  })
})
