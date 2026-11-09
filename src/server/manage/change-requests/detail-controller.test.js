import { describe, test, expect, vi } from 'vitest'

import { statusCodes } from '../../common/constants/status-codes.js'
import { apiClient } from '../../common/api-client.js'
import {
  MANAGE_REGISTRATION_ID as REGISTRATION_ID,
  MANAGE_MATERIAL as MATERIAL,
  MANAGE_CURRENT_YEAR as CURRENT_YEAR,
  MANAGE_URL,
  apiError,
  makeManageApp,
  mockManageGets,
  noChangeRequests,
  registrationOnlyExporter
} from '../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../common/test-helpers/manage-page.js'

vi.mock('../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const LIST_URL = `${MANAGE_URL}/change-requests`

const ITEM = {
  queried: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b01',
  inProgress: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b02',
  submitted: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b03',
  granted: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b04',
  withdrawn: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b05',
  refused: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b06',
  tonnage: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b07',
  lastYear: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b08',
  unknown: '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b99'
}

const detailUrl = (itemId) => `${LIST_URL}/${itemId}`

const SUBMITTER = { fullName: 'Sam Patel', email: 'sam.patel@example.com' }

const interimSite = (siteId, siteName, country, extra = {}) => ({
  siteId,
  siteNumber: String(siteId),
  siteName,
  country,
  addressLine1: '1 Quay Street',
  townOrCity: 'Port',
  operationCodes: ['R3', 'R13'],
  removedAt: null,
  ...extra
})

const ROTTERDAM = {
  siteId: 901801,
  orsId: '001',
  siteName: 'Rotterdam Recycling BV',
  addressLine1: 'Industrieweg 44',
  country: 'Netherlands',
  coordinates: '51.9, 4.4',
  contactName: 'Jan de Vries',
  contactEmail: 'jan@rotterdam.example',
  contactPhone: '+31 10 123 4567',
  operationCodes: ['R3'],
  code1: 'B3011',
  code2: 'B3020',
  repatriatedLoads: 'Returned to the UK by sea',
  conditionsOfExport: false,
  interimSites: [
    interimSite(901802, 'Calais Storage SARL', 'France', {
      operationCodes: ['R13']
    }),
    interimSite(901804, 'Old Depot GmbH', 'Germany', {
      removedAt: '2027-02-01T09:00:00Z'
    })
  ],
  besEvidence: {
    besEvidenceUploads: [
      {
        fileId: 'site-file',
        filename: 'site-certificate.pdf',
        besEvidenceExpiryDate: '2027-08-31T12:00:00Z'
      }
    ]
  }
}

const accreditationSite = (site) => ({
  siteId: site.siteId,
  orsId: site.orsId,
  accreditationStatus: 'Accredited',
  pendingRequestId: null,
  pendingRequestStatus: null,
  lockedFields: ['country', 'coordinates'],
  site
})

// A request's site entry as the GET sends it: the item's effective answers
// (its own answers over the ORS's) and its own BES evidence.
const orsItem = (itemId, status, extra = {}) => ({
  siteId: ROTTERDAM.siteId,
  orsId: ROTTERDAM.orsId,
  siteName: ROTTERDAM.siteName,
  answers: { operationCodes: ['R3', 'R4'], conditionsOfExport: true },
  effective: {
    country: 'Netherlands',
    coordinates: '51.9, 4.4',
    operationCodes: ['R3', 'R4'],
    conditionsOfExport: true
  },
  besEvidenceRequired: false,
  besEvidence: {
    besEvidenceUploads: [
      {
        fileId: 'item-file',
        filename: 'bes-certificate.pdf',
        besEvidenceExpiryDate: '2027-11-30T12:00:00Z'
      }
    ]
  },
  missingFields: [],
  isComplete: true,
  itemId,
  changeType: 'update-overseas-site',
  status,
  validFrom: null,
  withdrawnAt: null,
  ...extra
})

const submittedRequest = (requestId, createdAt, items, extra = {}) => ({
  requestId,
  changeType: 'add-overseas-site',
  status: 'Submitted',
  createdAt,
  updatedAt: createdAt,
  submittedAt: createdAt.replace('T09', 'T11'),
  submittedBy: SUBMITTER,
  caseManagementReference: `CR27${requestId}`,
  sites: items.sites ?? [],
  tonnageBandUpgrade: items.tonnage ?? null,
  ...extra
})

const CURRENT_VIEW = {
  ...noChangeRequests,
  sites: [accreditationSite(ROTTERDAM)],
  requests: [
    submittedRequest(
      'DRAFT',
      '2027-05-01T09:00:00Z',
      {
        sites: [
          orsItem(ITEM.inProgress, 'InProgress', {
            changeType: 'add-overseas-site'
          })
        ]
      },
      {
        status: 'InProgress',
        submittedAt: null,
        submittedBy: null,
        caseManagementReference: null
      }
    ),
    submittedRequest('R003', '2027-04-01T09:00:00Z', {
      sites: [orsItem(ITEM.queried, 'Queried')],
      tonnage: null
    }),
    submittedRequest('R002', '2027-03-12T09:00:00Z', {
      sites: [
        orsItem(ITEM.submitted, 'Submitted'),
        orsItem(ITEM.refused, 'Rejected')
      ]
    }),
    submittedRequest(
      'R001',
      '2027-02-03T09:00:00Z',
      {
        sites: [
          orsItem(ITEM.granted, 'Approved', {
            validFrom: '2027-03-02T09:00:00Z'
          }),
          orsItem(ITEM.withdrawn, 'Withdrawn', {
            validFrom: '2027-03-02T09:00:00Z',
            withdrawnAt: '2027-07-10T09:00:00Z'
          })
        ]
      },
      // Submitted while Case Management submission is off.
      { caseManagementReference: null }
    ),
    submittedRequest('R000', '2027-01-20T09:00:00Z', {
      tonnage: {
        itemId: ITEM.tonnage,
        changeType: 'upgrade-tonnage-band',
        status: 'Submitted',
        validFrom: null,
        withdrawnAt: null,
        requestedBand: 'UpTo10000'
      }
    })
  ]
}

const TONNAGE_ITEM = CURRENT_VIEW.requests.at(-1).tonnageBandUpgrade

// The current view with its tonnage item, and the request holding it, changed.
const tonnageView = (itemChanges, requestChanges = {}) => ({
  ...CURRENT_VIEW,
  requests: [
    submittedRequest(
      'R000',
      '2027-01-20T09:00:00Z',
      { tonnage: { ...TONNAGE_ITEM, ...itemChanges } },
      requestChanges
    )
  ]
})

const currentApp = makeManageApp()
const reprocessorApp = makeManageApp({ wasteProcessingType: 'reprocessor' })

describe('#manageChangeRequestDetailController', () => {
  const page = setupManagePageServer()
  const { get } = page

  async function getPage(itemId, changes = CURRENT_VIEW, apps = [currentApp]) {
    mockManageGets(apps, undefined, changes)
    const response = await get(detailUrl(itemId))
    expect(response.statusCode).toBe(statusCodes.ok)
    return response.result
  }

  const valueOf = (html, testId) => {
    const match = html.match(
      new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</`)
    )
    expect(match, testId).not.toBeNull()
    return match[1].replace(/\s+/g, ' ').trim()
  }

  describe('access', () => {
    test.each([detailUrl(ITEM.granted), `/cy${detailUrl(ITEM.granted)}`])(
      'GET %s returns 404 when the flag is off, without reading data',
      async (url) => {
        page.setInYearChangesEnabled(false)
        const getSpy = mockManageGets([currentApp])

        const { statusCode } = await get(url)

        expect(statusCode).toBe(statusCodes.notFound)
        expect(getSpy).not.toHaveBeenCalled()
      }
    )

    test('returns 403 without reading data when the operator cannot access the organisation', async () => {
      const getSpy = mockManageGets([currentApp])

      const { statusCode } = await get(
        `/manage/not-my-org/${REGISTRATION_ID}/${MATERIAL}/change-requests/${ITEM.granted}`
      )

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(getSpy).not.toHaveBeenCalled()
    })

    test.each(['not-a-guid', '12345', 'item-granted'])(
      'returns 400 without reading data for a malformed itemId (%s)',
      async (itemId) => {
        const getSpy = mockManageGets([currentApp], undefined, CURRENT_VIEW)

        const { statusCode } = await get(detailUrl(itemId))

        expect(statusCode).toBe(statusCodes.badRequest)
        expect(getSpy).not.toHaveBeenCalled()
      }
    )

    test('returns 404 for an itemId in none of the requests', async () => {
      mockManageGets([currentApp], undefined, CURRENT_VIEW)

      const { statusCode } = await get(detailUrl(ITEM.unknown))

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('returns 404 for an item on the previous year’s accreditation', async () => {
      const previousApp = makeManageApp({
        id: 'app-previous',
        year: CURRENT_YEAR - 1
      })
      const previousView = {
        ...CURRENT_VIEW,
        requests: [
          submittedRequest('LAST', '2026-04-01T09:00:00Z', {
            sites: [orsItem(ITEM.lastYear, 'Queried')]
          })
        ]
      }
      mockManageGets([previousApp, currentApp], undefined, (applicationId) =>
        applicationId === 'app-previous' ? previousView : CURRENT_VIEW
      )

      const { statusCode } = await get(detailUrl(ITEM.lastYear))

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('shows the service-problem page when the change requests cannot be read', async () => {
      mockManageGets(
        [currentApp],
        undefined,
        apiError(statusCodes.internalServerError)
      )

      const { statusCode, result } = await get(detailUrl(ITEM.granted))

      expect(statusCode).toBe(statusCodes.internalServerError)
      expect(result).toMatch(
        new RegExp(
          `href="${detailUrl(ITEM.granted)}"[^>]*data-testid="try-again-link"`
        )
      )
    })

    test('shows the service-problem page when the API fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValue(
        apiError(statusCodes.internalServerError)
      )

      const { statusCode } = await get(detailUrl(ITEM.granted))

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('ORS layout', () => {
    test('is headed with the site name and the "orgName (year, material)" caption', async () => {
      const result = await getPage(ITEM.queried)

      expect(valueOf(result, 'page-heading')).toBe(
        'Rotterdam Recycling BV (001)'
      )
      expect(valueOf(result, 'page-caption')).toBe(
        'Acme Recycling Ltd (2027, Plastic)'
      )
      expect(result).toMatch(/<title>\s*Rotterdam Recycling BV/)
    })

    test('shows Location, Site ID, Status, Date added and BES expiry date in the header row', async () => {
      const result = await getPage(ITEM.queried)

      const labels = [
        ...result.matchAll(/<dt class="govuk-body[^"]*">([^<]*)<\/dt>/g)
      ]
      expect(labels.map(([, label]) => label.trim())).toEqual([
        'Location:',
        'Site ID:',
        'Status:',
        'Date added:',
        'BES expiry date:'
      ])
      expect(valueOf(result, 'header-location')).toBe(
        'Industrieweg 44, Netherlands'
      )
      expect(valueOf(result, 'header-site-id')).toBe('001')
      expect(result).toMatch(
        /class="govuk-tag govuk-tag--orange"[^>]*data-testid="header-status"[^>]*>\s*QUERIED\s*</
      )
      expect(valueOf(result, 'header-date-added')).toBe('1 Apr 2027')
      // The item's own evidence, not the ORS's older file.
      expect(valueOf(result, 'header-bes-expiry')).toBe('30 Nov 2027')
    })

    test('falls back to the ORS’s BES evidence when the item has none', async () => {
      const view = {
        ...CURRENT_VIEW,
        requests: [
          submittedRequest('R009', '2027-04-01T09:00:00Z', {
            sites: [
              orsItem(ITEM.queried, 'Queried', {
                besEvidence: { besEvidenceUploads: [] }
              })
            ]
          })
        ]
      }

      const result = await getPage(ITEM.queried, view)

      expect(valueOf(result, 'header-bes-expiry')).toBe('31 Aug 2027')
      expect(valueOf(result, 'row-bes-evidence-value')).toBe(
        'site-certificate.pdf'
      )
    })

    test('shows the site details with the item’s effective answers', async () => {
      const result = await getPage(ITEM.queried)

      expect({
        siteName: valueOf(result, 'row-site-name-value'),
        location: valueOf(result, 'row-location-value'),
        contactName: valueOf(result, 'row-contact-name-value'),
        contactEmail: valueOf(result, 'row-contact-email-value'),
        contactPhone: valueOf(result, 'row-contact-phone-value'),
        operation: valueOf(result, 'row-recycling-operation-value'),
        basel: valueOf(result, 'row-basel-codes-value'),
        loads: valueOf(result, 'row-repatriated-loads-value'),
        conditions: valueOf(result, 'row-conditions-of-export-value'),
        bes: valueOf(result, 'row-bes-evidence-value')
      }).toEqual({
        siteName: 'Rotterdam Recycling BV',
        location: 'Industrieweg 44, Netherlands',
        contactName: 'Jan de Vries',
        contactEmail: 'jan@rotterdam.example',
        contactPhone: '+31 10 123 4567',
        operation: 'R3, R4',
        basel: 'B3011, B3020',
        loads: 'Returned to the UK by sea',
        conditions: 'Yes',
        bes: 'bes-certificate.pdf'
      })
      expect(result).toMatch(
        /data-testid="row-repatriated-loads"[\s\S]*?Arrangements for rejected or returned loads/
      )
    })

    // Found by RA-697's e2e spec: the backend's ORS records also carry the
    // flattened siteAddress, which already ends with the country.
    test('names the country once when the ORS’s flattened address includes it', async () => {
      const site = {
        ...ROTTERDAM,
        siteAddress: 'Industrieweg 44, Netherlands'
      }
      const view = {
        ...CURRENT_VIEW,
        sites: [accreditationSite(site)]
      }

      const result = await getPage(ITEM.queried, view)

      expect(valueOf(result, 'row-location-value')).toBe(
        'Industrieweg 44, Netherlands'
      )
      expect(valueOf(result, 'header-location')).toBe(
        'Industrieweg 44, Netherlands'
      )
    })

    test('lists the ORS’s current interim sites', async () => {
      const result = await getPage(ITEM.queried)

      expect(valueOf(result, 'interim-sites-heading')).toBe('Interim sites (1)')
      expect(valueOf(result, 'interim-site-901802')).toBe(
        'Calais Storage SARL, France, R13'
      )
      expect(result).not.toContain('Old Depot GmbH')
    })

    test('says when the ORS has no interim sites', async () => {
      const view = {
        ...CURRENT_VIEW,
        sites: [accreditationSite({ ...ROTTERDAM, interimSites: [] })]
      }

      const result = await getPage(ITEM.queried, view)

      expect(valueOf(result, 'interim-sites-heading')).toBe('Interim sites')
      expect(valueOf(result, 'no-interim-sites')).toBe(
        'No interim sites have been added.'
      )
    })

    test('has no actions: no buttons, forms, or Change, Remove or Add links', async () => {
      const result = await getPage(ITEM.queried)

      const content = result.slice(result.indexOf('<main'))
      expect(content).not.toMatch(/<button|<form|govuk-summary-list__actions/)
      expect(content).not.toMatch(/>\s*(Change|Remove|Add)\b/)
    })

    test('links back to the list', async () => {
      const result = await getPage(ITEM.queried)

      expect(result).toMatch(
        new RegExp(`href="${LIST_URL}"[^>]*data-testid="back-link"`)
      )
    })

    test('keeps the Welsh prefix on the Back link', async () => {
      mockManageGets([currentApp], undefined, CURRENT_VIEW)

      const { statusCode, result } = await get(`/cy${detailUrl(ITEM.queried)}`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toMatch(
        new RegExp(`href="/cy${LIST_URL}"[^>]*data-testid="back-link"`)
      )
      expect(result).toContain('[Welsh] Request details')
    })

    test('finds the item whatever the case of its id in the URL', async () => {
      const result = await getPage(ITEM.granted.toUpperCase())

      expect(valueOf(result, 'page-heading')).toBe(
        'Rotterdam Recycling BV (001)'
      )
    })
  })

  describe('tonnage layout', () => {
    test('is headed "Tonnage band upgrade" with the caption and a Status tag', async () => {
      const result = await getPage(ITEM.tonnage)

      expect(valueOf(result, 'page-heading')).toBe('Tonnage band upgrade')
      expect(valueOf(result, 'page-caption')).toBe(
        'Acme Recycling Ltd (2027, Plastic)'
      )
      expect(result).toMatch(/<title>\s*Tonnage band upgrade/)
      expect(result).toMatch(
        /class="govuk-tag govuk-tag--green"[^>]*data-testid="header-status"[^>]*>\s*SUBMITTED\s*</
      )
    })

    test('shows no site details, interim sites or site header', async () => {
      const result = await getPage(ITEM.tonnage)

      expect(result).not.toMatch(
        /data-testid="(site-summary|interim-sites-heading|header-location|header-site-id|header-bes-expiry)"/
      )
    })

    test.each([
      ['UpTo500', 'Up to 500 tonnes'],
      ['UpTo5000', 'Up to 5,000 tonnes'],
      ['UpTo10000', 'Up to 10,000 tonnes'],
      ['Over10000', 'More than 10,000 tonnes']
    ])('shows the requested band %s as "%s"', async (requestedBand, label) => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView({ requestedBand }),
        [reprocessorApp]
      )

      expect(valueOf(result, 'row-requested-band-label')).toBe('Tonnage band')
      expect(valueOf(result, 'row-requested-band-value')).toBe(label)
    })

    test('labels the row "Tonnage band" for an exporter too', async () => {
      const result = await getPage(ITEM.tonnage)

      expect(valueOf(result, 'row-requested-band-label')).toBe('Tonnage band')
    })

    test('shows "Not provided" for a band the page does not know', async () => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView({ requestedBand: 'UpTo99999' })
      )

      expect(valueOf(result, 'row-requested-band-value')).toBe('Not provided')
    })

    test('has no actions and links back to the list', async () => {
      const result = await getPage(ITEM.tonnage)

      const content = result.slice(result.indexOf('<main'))
      expect(content).not.toMatch(/<button|<form|govuk-summary-list__actions/)
      expect(content).not.toMatch(/>\s*(Change|Remove|Add)\b/)
      expect(result).toMatch(
        new RegExp(`href="${LIST_URL}"[^>]*data-testid="back-link"`)
      )
    })

    test('shows the request details of a submitted item', async () => {
      const result = await getPage(ITEM.tonnage)

      expect(valueOf(result, 'request-details-heading')).toBe('Request details')
      expect(valueOf(result, 'request-type')).toBe('Tonnage band upgrade')
      expect(valueOf(result, 'request-sent')).toBe('20 Jan 2027')
      expect(valueOf(result, 'request-submitted-by')).toBe('Sam Patel')
      expect(valueOf(result, 'request-valid-from')).toBe('Not applicable')
      expect(valueOf(result, 'request-valid-to')).toBe('Not applicable')
      expect(valueOf(result, 'request-reference')).toBe('CR27R000')
    })

    test('shows "Not submitted" and no reference for an In progress item', async () => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView(
          { status: 'InProgress' },
          {
            status: 'InProgress',
            submittedAt: null,
            submittedBy: null,
            caseManagementReference: null
          }
        )
      )

      expect(valueOf(result, 'request-sent')).toBe('Not submitted')
      expect(valueOf(result, 'request-submitted-by')).toBe('Not submitted')
      expect(valueOf(result, 'request-reference')).toBe('Not applicable')
    })

    test('a granted item is valid from its approval date to 31 Dec of the compliance year', async () => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView({ status: 'Approved', validFrom: '2027-04-01T09:00:00Z' })
      )

      expect(valueOf(result, 'header-status')).toBe('GRANTED')
      expect(valueOf(result, 'request-valid-from')).toBe('1 Apr 2027')
      expect(valueOf(result, 'request-valid-to')).toBe('31 Dec 2027')
    })

    test('a withdrawn item is valid from its approval date to its withdrawal date', async () => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView({
          status: 'Withdrawn',
          validFrom: '2027-04-01T09:00:00Z',
          withdrawnAt: '2027-08-15T09:00:00Z'
        })
      )

      expect(valueOf(result, 'request-valid-from')).toBe('1 Apr 2027')
      expect(valueOf(result, 'request-valid-to')).toBe('15 Aug 2027')
    })

    test('a Queried item shows the query notice, with no action', async () => {
      const result = await getPage(
        ITEM.tonnage,
        tonnageView({ status: 'Queried' })
      )

      const start = result.indexOf('data-testid="query-raised-banner"')
      expect(start).toBeGreaterThan(-1)
      const banner = result.slice(
        start,
        result.indexOf('data-testid="page-caption"', start)
      )
      expect(banner).toContain('A query has been raised on this request')
      expect(banner).not.toMatch(/<a |<button/)
    })

    test('is shown in Welsh under /cy', async () => {
      mockManageGets([currentApp], undefined, CURRENT_VIEW)

      const { statusCode, result } = await get(`/cy${detailUrl(ITEM.tonnage)}`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(valueOf(result, 'page-heading')).toBe(
        '[Welsh] Tonnage band upgrade'
      )
      expect(valueOf(result, 'row-requested-band-label')).toBe(
        '[Welsh] Tonnage band'
      )
      expect(valueOf(result, 'row-requested-band-value')).toBe(
        '[Welsh] Up to 10,000 tonnes'
      )
    })
  })

  describe('request details', () => {
    test('shows the type, when and by whom it was sent, and its reference', async () => {
      const result = await getPage(ITEM.queried)

      expect(valueOf(result, 'request-details-heading')).toBe('Request details')
      expect(valueOf(result, 'request-type')).toBe('ORS update')
      expect(valueOf(result, 'request-sent')).toBe('1 Apr 2027')
      expect(valueOf(result, 'request-submitted-by')).toBe('Sam Patel')
      expect(valueOf(result, 'request-reference')).toBe('CR27R003')
    })

    test('shows "Not submitted" and no reference for an In progress item', async () => {
      const result = await getPage(ITEM.inProgress)

      expect(valueOf(result, 'request-type')).toBe('New ORS accreditation')
      expect(valueOf(result, 'request-sent')).toBe('Not submitted')
      expect(valueOf(result, 'request-submitted-by')).toBe('Not submitted')
      expect(valueOf(result, 'request-reference')).toBe('Not applicable')
    })

    test('shows "Not applicable" for a submitted request with no reference', async () => {
      const result = await getPage(ITEM.granted)

      expect(valueOf(result, 'request-reference')).toBe('Not applicable')
    })

    test('a granted item is valid from its approval date to 31 Dec of the compliance year', async () => {
      const result = await getPage(ITEM.granted)

      expect(valueOf(result, 'request-valid-from')).toBe('2 Mar 2027')
      expect(valueOf(result, 'request-valid-to')).toBe('31 Dec 2027')
    })

    test('a withdrawn item is valid from its approval date to its withdrawal date', async () => {
      const result = await getPage(ITEM.withdrawn)

      expect(valueOf(result, 'request-valid-from')).toBe('2 Mar 2027')
      expect(valueOf(result, 'request-valid-to')).toBe('10 Jul 2027')
    })

    test.each([
      ['In progress', ITEM.inProgress],
      ['Queried', ITEM.queried],
      ['Submitted', ITEM.submitted],
      ['Refused', ITEM.refused]
    ])(
      'a %s item shows "Not applicable" for both validity dates',
      async (_status, itemId) => {
        const result = await getPage(itemId)

        expect(valueOf(result, 'request-valid-from')).toBe('Not applicable')
        expect(valueOf(result, 'request-valid-to')).toBe('Not applicable')
      }
    )
  })

  // RA-697 task 013: an exporter with an Approved registration and no
  // Approved current-year accreditation.
  describe('registration only', () => {
    const REGISTRATION_VIEW_URL = `/api/v1/accreditation-changes/org-123/registrations/${REGISTRATION_ID}/${MATERIAL}`
    // The registration view keys each ORS by its ORS id's integer value, and
    // its items carry the same siteId and orsId.
    const PORTO = {
      ...ROTTERDAM,
      siteId: 7,
      orsId: '007',
      siteName: 'Porto Plasticos Lda',
      addressLine1: 'Rua do Porto 12',
      country: 'Portugal',
      interimSites: [
        interimSite(70, 'Leixoes Store', 'Portugal', {
          operationCodes: ['R13']
        })
      ]
    }
    const portoItem = (itemId, status, extra = {}) =>
      orsItem(itemId, status, {
        siteId: PORTO.siteId,
        orsId: PORTO.orsId,
        siteName: PORTO.siteName,
        effective: { ...orsItem().effective, country: 'Portugal' },
        ...extra
      })
    const REGISTRATION_VIEW = {
      ...noChangeRequests,
      applicationId: null,
      accreditationReference: null,
      sites: [
        { ...accreditationSite(PORTO), accreditationStatus: 'Registered' }
      ],
      requests: [
        submittedRequest('Q001', '2027-04-01T09:00:00Z', {
          sites: [portoItem(ITEM.queried, 'Queried')]
        }),
        submittedRequest('G001', '2027-02-03T09:00:00Z', {
          sites: [
            portoItem(ITEM.granted, 'Approved', {
              validFrom: '2027-03-02T09:00:00Z'
            })
          ]
        })
      ]
    }

    async function getRegistrationOnly(itemId, view = REGISTRATION_VIEW) {
      const spy = mockManageGets([], registrationOnlyExporter, view)
      const response = await get(detailUrl(itemId))
      expect(response.statusCode).toBe(statusCodes.ok)
      return { result: response.result, spy }
    }

    test('reads the item from the registration view', async () => {
      const { spy } = await getRegistrationOnly(ITEM.granted)

      expect(spy).toHaveBeenCalledWith(REGISTRATION_VIEW_URL)
    })

    test('is headed with the site name and the registration’s caption', async () => {
      const { result } = await getRegistrationOnly(ITEM.granted)

      expect(valueOf(result, 'page-heading')).toBe('Porto Plasticos Lda (007)')
      expect(valueOf(result, 'page-caption')).toBe(
        'Reg Only Exports Ltd (2027, Plastic)'
      )
    })

    test('shows the header, the site rows and the interim sites', async () => {
      const { result } = await getRegistrationOnly(ITEM.queried)

      expect({
        location: valueOf(result, 'header-location'),
        siteId: valueOf(result, 'header-site-id'),
        status: valueOf(result, 'header-status'),
        dateAdded: valueOf(result, 'header-date-added'),
        besExpiry: valueOf(result, 'header-bes-expiry'),
        siteName: valueOf(result, 'row-site-name-value'),
        rowLocation: valueOf(result, 'row-location-value'),
        contactName: valueOf(result, 'row-contact-name-value'),
        operation: valueOf(result, 'row-recycling-operation-value'),
        interimHeading: valueOf(result, 'interim-sites-heading'),
        interim: valueOf(result, 'interim-site-70')
      }).toEqual({
        location: 'Rua do Porto 12, Portugal',
        siteId: '007',
        status: 'QUERIED',
        dateAdded: '1 Apr 2027',
        besExpiry: '30 Nov 2027',
        siteName: 'Porto Plasticos Lda',
        rowLocation: 'Rua do Porto 12, Portugal',
        contactName: 'Jan de Vries',
        operation: 'R3, R4',
        interimHeading: 'Interim sites (1)',
        interim: 'Leixoes Store, Portugal, R13'
      })
    })

    test('shows the request details, valid to 31 Dec of the current year', async () => {
      const { result } = await getRegistrationOnly(ITEM.granted)

      expect({
        type: valueOf(result, 'request-type'),
        sent: valueOf(result, 'request-sent'),
        submittedBy: valueOf(result, 'request-submitted-by'),
        validFrom: valueOf(result, 'request-valid-from'),
        validTo: valueOf(result, 'request-valid-to'),
        reference: valueOf(result, 'request-reference')
      }).toEqual({
        type: 'ORS update',
        sent: '3 Feb 2027',
        submittedBy: 'Sam Patel',
        validFrom: '2 Mar 2027',
        validTo: '31 Dec 2027',
        reference: 'CR27G001'
      })
    })

    test('returns 404 for an item that is not one of the registration’s', async () => {
      mockManageGets([], registrationOnlyExporter, REGISTRATION_VIEW)

      const { statusCode } = await get(detailUrl(ITEM.submitted))

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('shows the service-problem page when the registration view cannot be read', async () => {
      mockManageGets(
        [],
        registrationOnlyExporter,
        apiError(statusCodes.internalServerError)
      )

      const { statusCode } = await get(detailUrl(ITEM.granted))

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  // RA-697 task 013: an accredited view also lists registration-only items,
  // whose numeric site key may not be the accreditation's.
  describe('site lookup', () => {
    test('finds the item’s site by ORS id when the numeric keys differ', async () => {
      const view = {
        ...CURRENT_VIEW,
        requests: [
          submittedRequest('REG1', '2027-04-01T09:00:00Z', {
            sites: [orsItem(ITEM.submitted, 'Submitted', { siteId: 1 })]
          })
        ]
      }

      const result = await getPage(ITEM.submitted, view)

      expect(valueOf(result, 'row-contact-name-value')).toBe('Jan de Vries')
      expect(valueOf(result, 'interim-site-901802')).toBe(
        'Calais Storage SARL, France, R13'
      )
    })

    test('falls back to the site key when the item has no ORS id', async () => {
      const view = {
        ...CURRENT_VIEW,
        requests: [
          submittedRequest('R010', '2027-04-01T09:00:00Z', {
            sites: [orsItem(ITEM.submitted, 'Submitted', { orsId: null })]
          })
        ]
      }

      const result = await getPage(ITEM.submitted, view)

      expect(valueOf(result, 'header-site-id')).toBe('001')
      expect(valueOf(result, 'row-contact-name-value')).toBe('Jan de Vries')
    })

    test('prefers the ORS id over a site key that names another site', async () => {
      const other = {
        ...ROTTERDAM,
        siteId: 5,
        orsId: '005',
        siteName: 'Other Site',
        contactName: 'Someone Else'
      }
      const view = {
        ...CURRENT_VIEW,
        sites: [accreditationSite(ROTTERDAM), accreditationSite(other)],
        requests: [
          submittedRequest('REG2', '2027-04-01T09:00:00Z', {
            sites: [orsItem(ITEM.submitted, 'Submitted', { siteId: 5 })]
          })
        ]
      }

      const result = await getPage(ITEM.submitted, view)

      expect(valueOf(result, 'row-contact-name-value')).toBe('Jan de Vries')
    })

    test('does not take a site with another ORS id, so an unlisted ORS keeps the item’s own name', async () => {
      const view = {
        ...CURRENT_VIEW,
        requests: [
          submittedRequest('REG3', '2027-04-01T09:00:00Z', {
            sites: [
              orsItem(ITEM.submitted, 'Submitted', {
                siteId: ROTTERDAM.siteId,
                orsId: '009',
                siteName: 'Unlisted ORS'
              })
            ]
          })
        ]
      }

      const result = await getPage(ITEM.submitted, view)

      expect(valueOf(result, 'page-heading')).toBe('Unlisted ORS (009)')
      expect(valueOf(result, 'header-site-id')).toBe('009')
      expect(valueOf(result, 'row-contact-name-value')).toBe('Not provided')
    })
  })

  describe('queried notice', () => {
    test('says a query has been raised on a Queried item, with no action', async () => {
      const result = await getPage(ITEM.queried)

      const start = result.indexOf('data-testid="query-raised-banner"')
      expect(start).toBeGreaterThan(-1)
      const banner = result.slice(
        start,
        result.indexOf('data-testid="page-caption"', start)
      )
      expect(banner).toContain('A query has been raised on this request')
      expect(banner).not.toMatch(/<a |<button/)
      expect(result).toMatch(
        /class="govuk-notification-banner app-notification-banner--full-width"[^>]*data-testid="query-raised-banner"/
      )
    })

    test.each([ITEM.inProgress, ITEM.submitted, ITEM.granted])(
      'is not shown on a non-Queried item (%s)',
      async (itemId) => {
        const result = await getPage(itemId)

        expect(result).not.toContain('query-raised-banner')
      }
    )
  })
})
