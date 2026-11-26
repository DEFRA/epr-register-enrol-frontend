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

const APP = 'a26000000000000000050025'
const BASE = `/accreditation/manage-overseas-sites/${APP}`
const UPDATE = `${BASE}/update/902501`
const MANAGE = '/manage/50025/R26EX0500250001PL/Plastic/overseas-sites'
const CHANGE_ID = '7a1c2d0e-0000-4000-8000-000000000001'

const SITE = {
  siteId: 902501,
  orsId: '001',
  siteName: 'Gdansk Recykling',
  addressLine1: '902501 Harbour Estate',
  townOrCity: 'Port',
  country: 'Poland',
  coordinates: '54.3520, 18.6466',
  operationCodes: ['R3'],
  conditionsOfExport: true,
  code1: 'B3011',
  contactName: 'Site Manager',
  contactEmail: 'site@example.com',
  contactPhone: '+44 1234',
  repatriatedLoads: 'Returned to the UK exporter.',
  validFrom: '2026-01-01T00:00:00Z',
  besEvidence: { besEvidenceUploads: [{ fileId: 'f1', filename: 'bes.pdf' }] },
  interimSites: [
    {
      siteId: 902511,
      siteName: 'Gdynia Transfer Hub',
      country: 'Poland',
      addressLine1: '1 Quay Street',
      townOrCity: 'Port',
      contactName: 'Alex Morgan',
      contactEmail: 'alex@example.com',
      contactPhone: '0123456789',
      operationCodes: ['R3', 'R13']
    },
    {
      siteId: 902512,
      siteName: 'Szczecin Sorting Centre',
      country: 'Poland',
      addressLine1: '2 Quay Street',
      townOrCity: 'Port',
      contactName: 'Alex Morgan',
      contactEmail: 'alex@example.com',
      contactPhone: '0123456789',
      operationCodes: ['R13']
    }
  ]
}

const DETAILS = {
  siteName: SITE.siteName,
  addressLine1: SITE.addressLine1,
  addressLine2: null,
  townOrCity: SITE.townOrCity,
  contactName: SITE.contactName,
  contactEmail: SITE.contactEmail,
  contactPhone: SITE.contactPhone,
  repatriatedLoads: SITE.repatriatedLoads
}

function updateItem(overrides = {}) {
  return {
    siteId: 902501,
    orsId: '001',
    siteName: SITE.siteName,
    changeType: 'update-overseas-site',
    previous: DETAILS,
    proposed: { ...DETAILS, siteName: 'Gdansk Recycling' },
    interimSiteChanges: [],
    missingFields: [],
    isComplete: true,
    status: 'InProgress',
    ...overrides
  }
}

function makeView({ item = null, pending = null, requests } = {}) {
  const activeRequest = item
    ? {
        requestId: 'req-1',
        status: 'InProgress',
        sites: [item],
        isComplete: true,
        charge: { chargeableSites: 0, chargePerSitePence: 32800, totalPence: 0 }
      }
    : null
  return {
    organisationId: '50025',
    applicationId: APP,
    registrationReference: 'R26EX0500250001PL',
    materialType: 'Plastic',
    year: 2026,
    sites: [
      {
        siteId: 902501,
        orsId: '001',
        accreditationStatus: 'Accredited',
        pendingRequestStatus: pending ?? (item ? 'InProgress' : null),
        lockedFields: [],
        site: SITE
      },
      {
        siteId: 902504,
        orsId: '004',
        accreditationStatus: 'Registered',
        pendingRequestStatus: null,
        lockedFields: [],
        site: {
          siteId: 902504,
          siteName: 'Ghent Recycling',
          country: 'Belgium'
        }
      }
    ],
    activeRequest,
    requests: requests ?? (activeRequest ? [activeRequest] : [])
  }
}

function mockGet(view) {
  return vi.spyOn(apiClient, 'get').mockResolvedValue(view)
}

function apiError(status, response) {
  return Object.assign(new Error(`HTTP ${status}`), { status, response })
}

describe('#updateOverseasSite (RA-682)', () => {
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
  })

  test('is 404 while in-year changes are off', async () => {
    vi.restoreAllMocks()
    setFeatureFlag('inYearChangesEnabled', false)
    const { statusCode } = await server.inject(UPDATE)
    expect(statusCode).toBe(statusCodes.notFound)
  })

  describe('Site details', () => {
    test('AC02: editable rows link to their steps and locked rows have none', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject(UPDATE)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('Gdansk Recykling (001)')
      expect(result).toMatch(/data-testid="site-status-tag">Approved/)
      for (const [row, step] of [
        ['site-name', 'site-name'],
        ['location', 'location'],
        ['contact-email', 'contact-details'],
        ['repatriated-loads', 'rejected-loads']
      ]) {
        expect(result).toContain(
          `href="${UPDATE}/details/${step}" data-testid="row-${row}-action"`
        )
      }
      for (const row of [
        'coordinates',
        'recycling-operations',
        'basel-codes',
        'conditions-of-export',
        'bes-evidence'
      ]) {
        expect(result).not.toContain(`data-testid="row-${row}-action"`)
      }
      expect(result).toContain('bes.pdf')
      expect(result).toContain('Interim sites (2)')
      expect(result).not.toContain('data-testid="save-and-continue"')
    })

    test('an ORS in the draft shows its proposed details, interim changes and Save and continue', async () => {
      mockGet(
        makeView({
          item: updateItem({
            interimSiteChanges: [
              {
                changeId: 'c-change',
                action: 'change',
                interimSiteId: 902511,
                proposed: {
                  ...SITE.interimSites[0],
                  siteName: 'Gdynia Port Hub'
                }
              },
              { changeId: 'c-remove', action: 'remove', interimSiteId: 902512 },
              {
                changeId: CHANGE_ID,
                action: 'add',
                interimSiteId: null,
                proposed: {
                  siteName: 'Krakow Depot',
                  country: 'Poland',
                  operationCodes: ['R13']
                }
              }
            ]
          })
        })
      )
      const { result } = await server.inject(`${UPDATE}?updated=site-name`)

      expect(result).toMatch(/data-testid="site-status-tag">In progress/)
      expect(result).toContain('Site name updated.')
      expect(result).toMatch(
        /data-testid="row-site-name-value">Gdansk Recycling</
      )
      expect(result).toContain('Gdynia Port Hub')
      expect(result).toMatch(/data-testid="interim-902511-state">Changed/)
      expect(result).toMatch(/data-testid="interim-902512-state">To be removed/)
      expect(result).not.toContain('data-testid="interim-902512-remove"')
      expect(result).toContain(`data-testid="interim-new-${CHANGE_ID}-state"`)
      expect(result).toContain('Krakow Depot')
      expect(result).toContain(
        `href="${BASE}/requests" data-testid="save-and-continue"`
      )
    })

    test('an unknown updated key shows no banner', async () => {
      mockGet(makeView())
      const { result } = await server.inject(`${UPDATE}?updated=nonsense`)
      expect(result).not.toContain('data-testid="success-banner"')
    })

    test('AC03: an ORS held by a submitted request is read only', async () => {
      mockGet(makeView({ pending: 'Submitted' }))
      const { result } = await server.inject(UPDATE)

      expect(result).toMatch(/data-testid="site-status-tag">Pending/)
      expect(result).toContain('data-testid="pending-inset"')
      expect(result).not.toContain('data-testid="row-site-name-action"')
      expect(result).not.toContain('data-testid="add-interim-site"')
      expect(result).not.toContain('data-testid="interim-902511-change"')
    })

    test('a site that is not an accredited ORS goes back to Manage ORS', async () => {
      mockGet(makeView())
      const { headers } = await server.inject(`${BASE}/update/902504`)
      expect(headers.location).toBe(MANAGE)
    })
  })

  describe('Detail steps', () => {
    test('a step shows the current values, with locked fields as read-only inputs', async () => {
      mockGet(makeView())
      const { statusCode, result } = await server.inject(
        `${UPDATE}/details/location`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('value="902501 Harbour Estate"')
      expect(result).toMatch(
        /id="country" name="country" type="text" value="Poland" readonly/
      )
      expect(result).toMatch(
        /id="coordinates" name="coordinates" type="text" value="54.3520, 18.6466" readonly/
      )
    })

    test('an unknown step is 400', async () => {
      const { statusCode } = await server.inject(`${UPDATE}/details/country`)
      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('saving starts the update and patches the details, sending the read-only fields unchanged', async () => {
      mockGet(makeView())
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/details/location`,
        payload: {
          addressLine1: ' 1 New Road ',
          addressLine2: '',
          townOrCity: 'Gdynia',
          country: 'Poland',
          coordinates: '54.3520, 18.6466'
        }
      })

      expect(post).toHaveBeenCalledWith(
        expect.stringMatching(/requests\/current\/sites$/),
        {
          siteId: 902501,
          changeType: 'update-overseas-site'
        }
      )
      expect(patch).toHaveBeenCalledWith(
        expect.stringMatching(/requests\/current\/sites\/902501$/),
        {
          addressLine1: '1 New Road',
          addressLine2: '',
          townOrCity: 'Gdynia',
          country: 'Poland',
          coordinates: '54.3520, 18.6466'
        }
      )
      expect(headers.location).toBe(`${UPDATE}?updated=location`)
    })

    test.each([
      ['site-name', { siteName: '' }, 'Enter the site name'],
      [
        'contact-details',
        { contactName: 'Ola', contactEmail: 'nope' },
        'Enter an email address in the correct format'
      ],
      ['rejected-loads', { repatriatedLoads: ' ' }, 'Describe the arrangements']
    ])(
      '%s: an invalid answer is shown and nothing is saved',
      async (step, payload, message) => {
        mockGet(makeView())
        const patch = vi.spyOn(apiClient, 'patch')
        const { statusCode, result } = await server.inject({
          method: 'POST',
          url: `${UPDATE}/details/${step}`,
          payload
        })
        expect(statusCode).toBe(statusCodes.badRequest)
        expect(result).toContain(message)
        expect(patch).not.toHaveBeenCalled()
      }
    )

    test("the backend's refusal is shown against its field", async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post').mockResolvedValue({})
      vi.spyOn(apiClient, 'patch').mockRejectedValue(
        apiError(400, { errors: { SiteName: ['Site name is taken.'] } })
      )
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/details/site-name`,
        payload: { siteName: 'Gdansk' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Site name is taken.')
    })

    test('a refusal that names no field shows a general message', async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post').mockResolvedValue({})
      vi.spyOn(apiClient, 'patch').mockRejectedValue(apiError(400, 'not json'))
      const { result } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/details/site-name`,
        payload: { siteName: 'Gdansk' }
      })
      expect(result).toContain('This information could not be saved')
    })

    test('AC03: an ORS a submitted request holds goes back to its details', async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(409))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/details/site-name`,
        payload: { siteName: 'Gdansk' }
      })
      expect(headers.location).toBe(UPDATE)
    })

    test('a pending ORS has no steps', async () => {
      mockGet(makeView({ pending: 'Submitted' }))
      const { headers } = await server.inject(`${UPDATE}/details/site-name`)
      expect(headers.location).toBe(UPDATE)
    })

    test('any other backend failure is an error', async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post').mockRejectedValue(apiError(503))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/details/site-name`,
        payload: { siteName: 'Gdansk' }
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('Interim sites (AC04)', () => {
    const INTERIM_FORM = {
      siteName: 'Gdynia Port Hub',
      addressLine1: '1 Quay Street',
      townOrCity: 'Port',
      contactName: 'Alex Morgan',
      contactEmail: 'alex@example.com',
      contactPhone: '0123456789'
    }

    test('changing one shows its country and recycling operations read only', async () => {
      mockGet(makeView())
      const { result } = await server.inject(`${UPDATE}/interim-sites/902511`)
      expect(result).toContain('Change an interim site')
      expect(result).toMatch(
        /id="country" name="country" type="text" value="Poland" readonly/
      )
      expect(result).toContain('value="R3, R13" readonly')
    })

    test('a change keeps its country and recycling operations whatever is posted', async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})

      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/902511`,
        payload: { ...INTERIM_FORM, country: 'Germany', operationCodes: 'R4' }
      })

      expect(patch).toHaveBeenCalledWith(
        expect.stringMatching(/sites\/902501\/interim-sites\/902511$/),
        expect.objectContaining({
          siteName: 'Gdynia Port Hub',
          country: 'Poland',
          operationCodes: ['R3', 'R13'],
          addressLine2: null,
          postcode: null
        })
      )
      expect(headers.location).toBe(`${UPDATE}?updated=interim-sites`)
    })

    test('an unknown interim site goes back to the details', async () => {
      mockGet(makeView())
      expect(
        (await server.inject(`${UPDATE}/interim-sites/999`)).headers.location
      ).toBe(UPDATE)
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/999`,
        payload: INTERIM_FORM
      })
      expect(headers.location).toBe(UPDATE)
    })

    test('adding one needs its country and an R12 or R13 operation', async () => {
      mockGet(makeView())
      const { result: form } = await server.inject(
        `${UPDATE}/interim-sites/new`
      )
      expect(form).toContain('Add an interim site')
      expect(form).toContain('data-testid="operation-R12"')

      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/new`,
        payload: { ...INTERIM_FORM, operationCodes: 'R3' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter the country')
      expect(result).toContain('Select R12 or R13')
    })

    test('adding one posts it to the update', async () => {
      mockGet(makeView())
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/new`,
        payload: {
          ...INTERIM_FORM,
          country: 'Poland',
          operationCodes: ['R12', 'R3']
        }
      })
      expect(post).toHaveBeenLastCalledWith(
        expect.stringMatching(/sites\/902501\/interim-sites$/),
        expect.objectContaining({
          country: 'Poland',
          operationCodes: ['R12', 'R3']
        })
      )
      expect(headers.location).toBe(`${UPDATE}?updated=interim-sites`)
    })

    test("the backend's refusal of an interim site is shown", async () => {
      mockGet(makeView())
      vi.spyOn(apiClient, 'post')
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(
          apiError(400, { errors: { ContactEmail: ['Bad email.'] } })
        )
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/new`,
        payload: { ...INTERIM_FORM, country: 'Poland', operationCodes: 'R13' }
      })
      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Bad email.')
    })

    test('a pending addition can be edited', async () => {
      const addition = {
        changeId: CHANGE_ID,
        action: 'add',
        interimSiteId: null,
        proposed: {
          ...INTERIM_FORM,
          siteName: 'Krakow Depot',
          country: 'Poland',
          operationCodes: ['R13']
        }
      }
      mockGet(
        makeView({ item: updateItem({ interimSiteChanges: [addition] }) })
      )
      const { result } = await server.inject(
        `${UPDATE}/interim-site-changes/${CHANGE_ID}`
      )
      expect(result).toContain('value="Krakow Depot"')

      vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
      await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-site-changes/${CHANGE_ID}`,
        payload: {
          ...INTERIM_FORM,
          siteName: 'Krakow Hub',
          country: 'Poland',
          operationCodes: 'R13'
        }
      })
      expect(patch).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`interim-site-changes/${CHANGE_ID}$`)),
        expect.objectContaining({ siteName: 'Krakow Hub' })
      )
    })

    test('an unknown addition goes back to the details', async () => {
      mockGet(makeView({ item: updateItem() }))
      expect(
        (await server.inject(`${UPDATE}/interim-site-changes/${CHANGE_ID}`))
          .headers.location
      ).toBe(UPDATE)
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-site-changes/${CHANGE_ID}`,
        payload: INTERIM_FORM
      })
      expect(headers.location).toBe(UPDATE)
    })

    test('remove and undo change the draft and return to the details', async () => {
      mockGet(makeView({ item: updateItem() }))
      vi.spyOn(apiClient, 'post').mockResolvedValue({})
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

      const removed = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-sites/902512/remove`
      })
      expect(del).toHaveBeenCalledWith(
        expect.stringMatching(/interim-sites\/902512$/)
      )
      expect(removed.headers.location).toBe(`${UPDATE}?updated=interim-sites`)

      const undone = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-site-changes/${CHANGE_ID}/undo`
      })
      expect(del).toHaveBeenLastCalledWith(
        expect.stringMatching(new RegExp(`interim-site-changes/${CHANGE_ID}$`))
      )
      expect(undone.headers.location).toBe(UPDATE)
    })

    test('undoing a change already gone still returns to the details', async () => {
      mockGet(makeView({ item: updateItem() }))
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-site-changes/${CHANGE_ID}/undo`
      })
      expect(headers.location).toBe(UPDATE)
    })

    test('undo passes on any other failure', async () => {
      mockGet(makeView({ item: updateItem() }))
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(500))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/interim-site-changes/${CHANGE_ID}/undo`
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('Cancel and submitted', () => {
    test('cancel takes the update out of the draft and returns to the requests', async () => {
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/cancel`
      })
      expect(del).toHaveBeenCalledWith(
        expect.stringMatching(/requests\/current\/sites\/902501$/)
      )
      expect(headers.location).toBe(`${BASE}/requests`)
    })

    test('cancelling an update already gone still returns to the requests', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(404))
      const { headers } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/cancel`
      })
      expect(headers.location).toBe(`${BASE}/requests`)
    })

    test('cancel passes on any other failure', async () => {
      vi.spyOn(apiClient, 'delete').mockRejectedValue(apiError(500))
      const { statusCode } = await server.inject({
        method: 'POST',
        url: `${UPDATE}/cancel`
      })
      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('AC06: the submitted page shows the references', async () => {
      mockGet(
        makeView({
          requests: [
            {
              status: 'Submitted',
              sites: [
                { caseManagementReference: 'IYC-ORS-2026-00007' },
                { caseManagementReference: null }
              ]
            }
          ]
        })
      )
      const { result } = await server.inject(`${BASE}/submitted`)
      expect(result).toContain('In year change application submitted')
      expect(result).toContain('IYC-ORS-2026-00007')
    })

    test('with nothing submitted the submitted page goes back to Manage ORS', async () => {
      mockGet(makeView())
      const { headers } = await server.inject(`${BASE}/submitted`)
      expect(headers.location).toBe(MANAGE)
    })
  })
})
