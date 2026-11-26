import { describe, test, expect, vi, beforeEach } from 'vitest'

import { statusCodes } from '../../../common/constants/status-codes.js'
import { apiClient } from '../../../common/api-client.js'
import {
  MANAGE_URL,
  makeManageApp,
  mockManageGets,
  noChangeRequests
} from '../../../common/test-helpers/manage-api.js'
import { setupManagePageServer } from '../../../common/test-helpers/manage-page.js'

vi.mock('../../../common/helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

const ITEM_ID = '0b6a3c1e-5d2f-4a8b-9c71-1e2d3f4a5b01'
const ITEM_URL = `${MANAGE_URL}/change-requests/${ITEM_ID}`
const CHANGES = '/api/v1/accreditation-changes/reex-org-123/app-current'

const SITE = {
  siteId: 901801,
  orsId: '001',
  siteName: 'Rotterdam Recycling BV',
  addressLine1: 'Industrieweg 44',
  townOrCity: 'Rotterdam',
  country: 'Netherlands',
  coordinates: '51.9, 4.4',
  contactName: 'Jan de Vries',
  contactEmail: 'jan@rotterdam.example',
  contactPhone: '+31 10 123 4567',
  repatriatedLoads: 'Returned by sea',
  interimSites: [
    {
      siteId: 901802,
      siteNumber: '2',
      siteName: 'Calais Storage SARL',
      country: 'France',
      operationCodes: ['R13'],
      removedAt: null
    }
  ]
}

const INTERIM = {
  siteId: 901802,
  siteNumber: '2',
  country: 'France',
  operationCodes: ['R13'],
  values: {
    siteName: 'Calais Storage SARL',
    addressLine1: '1 Quay Street',
    townOrCity: 'Calais',
    contactName: 'Marie',
    contactEmail: 'marie@calais.example',
    contactPhone: '+33 1 23 45 67 89'
  },
  editableFields: [
    'siteName',
    'addressLine1',
    'addressLine2',
    'townOrCity',
    'stateOrRegion',
    'postcode',
    'contactName',
    'contactEmail',
    'contactPhone'
  ],
  lockedFields: ['country', 'operationCodes']
}

const EDITABLE = [
  'siteName',
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'stateOrRegion',
  'postcode',
  'contactName',
  'contactEmail',
  'contactPhone',
  'rejectedLoadsArrangements',
  'besEvidence'
]

const queriedItem = (extra = {}, queryExtra = {}) => ({
  itemId: ITEM_ID,
  siteId: SITE.siteId,
  orsId: SITE.orsId,
  siteName: SITE.siteName,
  changeType: 'add-overseas-site',
  status: 'Queried',
  answers: {},
  effective: { country: 'Netherlands', coordinates: '51.9, 4.4' },
  besEvidenceRequired: false,
  besEvidence: {
    besEvidenceUploads: [
      { fileId: 'old-file', filename: 'old.pdf' },
      { fileId: 'new-file', filename: 'new.pdf' }
    ]
  },
  missingFields: [],
  isComplete: true,
  validFrom: null,
  withdrawnAt: null,
  caseManagementReference: 'CR-1',
  query: {
    queryNote: 'Please confirm the contact details.',
    raisedAt: '2027-06-01T09:00:00Z',
    querySubmissions: [],
    editableFields: EDITABLE,
    lockedFields: ['country', 'coordinates', 'operationCodes'],
    preQueryBesFileIds: ['old-file'],
    interimSites: [INTERIM],
    ...queryExtra
  },
  ...extra
})

const viewWith = (item) => ({
  ...noChangeRequests,
  organisationId: 'reex-org-123',
  registrationReference: 'R27EX0500180001PL',
  materialType: 'Plastic',
  hasOpenQuery: item.status === 'Queried',
  sites: [
    {
      siteId: SITE.siteId,
      orsId: SITE.orsId,
      accreditationStatus: 'Accredited',
      pendingRequestStatus: item.status,
      lockedFields: [],
      site: SITE
    }
  ],
  requests: [
    {
      requestId: 'R1',
      changeType: 'add-overseas-site',
      status: 'Submitted',
      createdAt: '2027-04-01T09:00:00Z',
      updatedAt: '2027-04-01T09:00:00Z',
      submittedAt: '2027-04-01T11:00:00Z',
      submittedBy: { fullName: 'Sam Patel' },
      sites: [item],
      tonnageBandUpgrade: null
    }
  ]
})

const app = makeManageApp()

describe('responding to a queried item (RA-698)', () => {
  const page = setupManagePageServer()
  const post = (url, payload = {}) =>
    page.server.inject({ method: 'POST', url, payload })

  let patch
  let postSpy

  beforeEach(() => {
    patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
    postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({})
  })

  const load = (item = queriedItem()) =>
    mockManageGets([app], undefined, viewWith(item))

  describe('the detail page', () => {
    test('shows the query note and Change links only for editable fields', async () => {
      load(
        queriedItem(
          {},
          { editableFields: ['siteName', 'contactName', 'besEvidence'] }
        )
      )

      const { result } = await page.get(ITEM_URL)

      expect(result).toContain('Please confirm the contact details.')
      expect(result).toContain('data-testid="row-site-name-action"')
      expect(result).toContain('data-testid="row-contact-name-action"')
      expect(result).toContain('data-testid="row-bes-evidence-action"')
      expect(result).not.toContain('data-testid="row-location-action"')
      expect(result).not.toContain('data-testid="row-repatriated-loads-action"')
      expect(result).not.toContain('row-operation-codes-action')
      expect(result).toContain('data-testid="save-and-continue-button"')
    })

    test('gives each interim site a Change link', async () => {
      load()

      const { result } = await page.get(ITEM_URL)

      expect(result).toContain('data-testid="change-interim-site-901802"')
      expect(result).toContain(`${ITEM_URL}/interim-sites/901802`)
    })

    test('has no Change links once the item is Updated', async () => {
      load(queriedItem({ status: 'Updated' }))

      const { result } = await page.get(ITEM_URL)

      expect(result).not.toContain('-action"')
      expect(result).not.toContain('change-interim-site')
      expect(result).not.toContain('save-and-continue-button')
    })

    test('shows the success banner after a change', async () => {
      load()
      const response = await post(`${ITEM_URL}/site-name`, {
        siteName: 'New name'
      })
      const cookie = response.headers['set-cookie']
        ?.map((c) => c.split(';')[0])
        .join('; ')

      const { result } = await page.server.inject({
        method: 'GET',
        url: ITEM_URL,
        headers: { cookie }
      })

      expect(result).toContain('data-testid="success-banner"')
      expect(result).toContain('ORS name updated')
    })
  })

  describe('the ORS steps', () => {
    test('GET the name page with the current name', async () => {
      load()

      const { statusCode, result } = await page.get(`${ITEM_URL}/site-name`)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('value="Rotterdam Recycling BV"')
    })

    test('POST the name patches the item and returns to the detail page', async () => {
      load()

      const response = await post(`${ITEM_URL}/site-name`, {
        siteName: '  New name '
      })

      expect(patch).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/answers`,
        {
          siteName: 'New name'
        }
      )
      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(ITEM_URL)
    })

    test('POST a blank name shows the error without patching', async () => {
      load()

      const { statusCode } = await post(`${ITEM_URL}/site-name`, {
        siteName: ''
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(patch).not.toHaveBeenCalled()
    })

    test('the location page shows country and coordinates greyed out', async () => {
      load()

      const { result } = await page.get(`${ITEM_URL}/location`)

      expect(result).toMatch(/data-testid="locked-country"[^>]*>/)
      expect(result).toContain('value="Netherlands"')
      expect(result).toContain('disabled')
      expect(result).not.toContain('name="country"')
      expect(result).not.toContain('name="coordinates"')
    })

    test('POST the location patches the address only', async () => {
      load()

      await post(`${ITEM_URL}/location`, {
        addressLine1: '1 New Street',
        addressLine2: '',
        townOrCity: 'Rotterdam',
        stateOrRegion: '',
        postcode: '3000 AA',
        country: 'France'
      })

      expect(patch).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/answers`,
        {
          addressLine1: '1 New Street',
          addressLine2: '',
          townOrCity: 'Rotterdam',
          stateOrRegion: '',
          postcode: '3000 AA'
        }
      )
    })

    test('POST contact details maps the form fields to the backend ones', async () => {
      load()

      await post(`${ITEM_URL}/contact-details`, {
        siteContactName: 'Pat',
        siteContactEmail: 'pat@example.com',
        siteContactPhone: ''
      })

      expect(patch).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/answers`,
        {
          contactName: 'Pat',
          contactEmail: 'pat@example.com',
          contactPhone: ''
        }
      )
    })

    test('POST the rejected loads arrangements', async () => {
      load()

      await post(`${ITEM_URL}/rejected-loads`, {
        repatriatedLoads: 'Sent back by rail'
      })

      expect(patch).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/answers`,
        {
          rejectedLoadsArrangements: 'Sent back by rail'
        }
      )
    })

    test('a backend 400 is shown against the field it names', async () => {
      load()
      patch.mockRejectedValue(
        Object.assign(new Error('400'), {
          status: 400,
          response: JSON.stringify({
            errors: { siteName: ['That name is taken'] }
          })
        })
      )

      const { statusCode, result } = await post(`${ITEM_URL}/site-name`, {
        siteName: 'Taken'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('That name is taken')
    })

    test('a backend 409 returns to the detail page', async () => {
      load()
      patch.mockRejectedValue(Object.assign(new Error('409'), { status: 409 }))

      const response = await post(`${ITEM_URL}/site-name`, {
        siteName: 'New name'
      })

      expect(response.headers.location).toBe(ITEM_URL)
    })

    test('another backend failure is not swallowed', async () => {
      load()
      patch.mockRejectedValue(Object.assign(new Error('500'), { status: 500 }))

      const { statusCode } = await post(`${ITEM_URL}/site-name`, {
        siteName: 'New name'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('a field the query leaves closed goes back to the detail page', async () => {
      load(queriedItem({}, { editableFields: ['contactName'] }))

      const response = await page.get(`${ITEM_URL}/site-name`)

      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(ITEM_URL)
    })

    test('a step for an item that is not Queried goes back to the detail page', async () => {
      load(queriedItem({ status: 'Updated' }))

      const response = await page.get(`${ITEM_URL}/site-name`)

      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(ITEM_URL)
      expect(patch).not.toHaveBeenCalled()
    })

    test('returns 404 for a tonnage item', async () => {
      mockManageGets([app], undefined, {
        ...viewWith(queriedItem()),
        requests: [
          {
            requestId: 'T1',
            sites: [],
            tonnageBandUpgrade: queriedItem({
              changeType: 'upgrade-tonnage-band'
            })
          }
        ]
      })

      const { statusCode } = await page.get(`${ITEM_URL}/site-name`)

      expect(statusCode).toBe(statusCodes.notFound)
    })

    test('returns 404 when the flag is off', async () => {
      page.setInYearChangesEnabled(false)
      load()

      const { statusCode } = await page.get(`${ITEM_URL}/site-name`)

      expect(statusCode).toBe(statusCodes.notFound)
    })
  })

  describe('the interim site pages', () => {
    const INTERIM_URL = `${ITEM_URL}/interim-sites/901802`

    test('the summary shows country and recycling operations without Change links', async () => {
      load()

      const { result } = await page.get(INTERIM_URL)

      expect(result).toContain('Calais Storage SARL')
      expect(result).toContain('data-testid="change-site-name"')
      expect(result).toContain('data-testid="change-contact-email"')
      expect(result).not.toContain('data-testid="change-country"')
      expect(result).not.toContain('data-testid="change-operation-codes"')
      expect(result).toContain('R13')
    })

    test('POST the interim name patches the interim site', async () => {
      load()

      const response = await post(`${INTERIM_URL}/site-name`, {
        siteName: 'Calais Depot'
      })

      expect(patch).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/interim-sites/901802/answers`,
        { siteName: 'Calais Depot' }
      )
      expect(response.headers.location).toBe(INTERIM_URL)
    })

    test('POST the interim address and contact', async () => {
      load()

      await post(`${INTERIM_URL}/location`, {
        addressLine1: '2 Quay Street',
        townOrCity: 'Calais'
      })
      await post(`${INTERIM_URL}/contact-details`, {
        siteContactName: 'Marie',
        siteContactEmail: 'marie@calais.example',
        siteContactPhone: '+33 1 23 45 67 89'
      })

      expect(patch).toHaveBeenCalledTimes(2)
      expect(patch.mock.calls[1][1]).toEqual({
        contactName: 'Marie',
        contactEmail: 'marie@calais.example',
        contactPhone: '+33 1 23 45 67 89'
      })
    })

    test('an interim site that is not on the ORS goes back to the detail page', async () => {
      load()

      const response = await page.get(`${ITEM_URL}/interim-sites/1/site-name`)

      expect(response.headers.location).toBe(ITEM_URL)
    })
  })

  describe('the BES evidence page', () => {
    test('lists the files from before the query without a remove button', async () => {
      load()

      const { result } = await page.get(`${ITEM_URL}/bes-evidence`)

      expect(result).toContain('data-testid="bes-file-old-file"')
      expect(result).not.toContain('remove-file-old-file')
      expect(result).toContain('data-testid="remove-file-new-file"')
    })

    test('removing a new file calls the backend and returns to the page', async () => {
      load()
      const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({})

      const response = await post(`${ITEM_URL}/bes-evidence/new-file/delete`)

      expect(del).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/bes-evidence/files/new-file`
      )
      expect(response.headers.location).toBe(`${ITEM_URL}/bes-evidence`)
    })

    test('a file from before the query stays, whatever the backend says', async () => {
      load()
      vi.spyOn(apiClient, 'delete').mockRejectedValue(
        Object.assign(new Error('422'), { status: 422 })
      )

      const response = await post(`${ITEM_URL}/bes-evidence/old-file/delete`)

      expect(response.statusCode).toBe(statusCodes.redirect)
    })

    test('the status page without an upload goes back to the upload page', async () => {
      load()

      const response = await page.get(`${ITEM_URL}/bes-evidence/status`)

      expect(response.headers.location).toBe(
        `${MANAGE_URL}/change-requests/${ITEM_ID}/bes-evidence`
      )
    })
  })

  describe('the declaration', () => {
    const DECLARATION = `${ITEM_URL}/declaration`
    const details = { fullName: 'Sam Patel', jobTitle: 'Director' }

    test('GET shows the declaration', async () => {
      load()

      const { statusCode, result } = await page.get(DECLARATION)

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toContain('data-testid="full-name-input"')
      expect(result).toContain('Confirm and submit')
    })

    test('GET goes back to the detail page while required BES evidence is missing', async () => {
      load(queriedItem({ missingFields: ['besEvidence'] }))

      const response = await page.get(DECLARATION)

      expect(response.headers.location).toBe(ITEM_URL)
    })

    test('POST without the declaration shows the errors', async () => {
      load()

      const { statusCode } = await post(DECLARATION, { fullName: '' })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(postSpy).not.toHaveBeenCalled()
    })

    test('POST resubmits the item and returns to the manage page', async () => {
      load()

      const response = await post(DECLARATION, details)

      expect(postSpy).toHaveBeenCalledWith(
        `${CHANGES}/items/${ITEM_ID}/resubmit`,
        expect.objectContaining(details),
        { timeout: 20000 }
      )
      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(MANAGE_URL)
    })

    test('the manage page then shows the Request updated banner', async () => {
      load()
      const response = await post(DECLARATION, details)
      const cookie = response.headers['set-cookie']
        ?.map((c) => c.split(';')[0])
        .join('; ')

      const { result } = await page.server.inject({
        method: 'GET',
        url: MANAGE_URL,
        headers: { cookie }
      })

      expect(result).toContain('Request updated')
    })

    test('a 422 (nothing changed) returns to the detail page with the reason', async () => {
      load()
      postSpy.mockRejectedValue(
        Object.assign(new Error('422'), { status: 422 })
      )

      const response = await post(DECLARATION, details)

      expect(response.headers.location).toBe(ITEM_URL)
    })

    test('a backend failure keeps the declaration with an error', async () => {
      load()
      postSpy.mockRejectedValue(
        Object.assign(new Error('503'), { status: 503 })
      )

      const { statusCode } = await post(DECLARATION, details)

      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('saving and coming back later does not resubmit', async () => {
      load()

      const response = await post(DECLARATION, {
        ...details,
        submitAction: 'saveAndComeLater'
      })

      expect(response.headers.location).toBe(ITEM_URL)
      expect(postSpy).not.toHaveBeenCalled()
    })
  })
})
