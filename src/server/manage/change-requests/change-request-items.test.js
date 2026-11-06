import { readFileSync } from 'node:fs'
import { describe, test, expect } from 'vitest'

import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import {
  changeTypeLabel,
  flattenItems,
  sortItems
} from './change-request-items.js'

const english = JSON.parse(
  readFileSync(
    new URL('../../../locales/en/translation.json', import.meta.url),
    'utf-8'
  )
)
const t = (key) =>
  key.split('.').reduce((node, part) => node?.[part], english) ?? key

const SUBMITTER = { fullName: 'Sam Patel', email: 'sam.patel@example.com' }

const siteItem = (itemId, overrides = {}) => ({
  siteId: 1,
  orsId: '001',
  siteName: 'Bharat Recycling',
  itemId,
  changeType: 'update-overseas-site',
  status: 'Submitted',
  validFrom: null,
  withdrawnAt: null,
  ...overrides
})

const request = (requestId, overrides = {}) => ({
  requestId,
  changeType: 'add-overseas-site',
  status: 'Submitted',
  createdAt: '2027-03-01T09:00:00Z',
  updatedAt: '2027-03-01T11:00:00Z',
  submittedAt: '2027-03-01T11:00:00Z',
  submittedBy: SUBMITTER,
  caseManagementReference: `CR-${requestId}`,
  sites: [],
  tonnageBandUpgrade: null,
  ...overrides
})

const accreditationSites = [
  {
    siteId: 1,
    orsId: '001',
    site: {
      siteId: 1,
      siteName: 'Bharat Recycling',
      addressLine1: '1 Industrial Road',
      country: 'India'
    }
  },
  {
    siteId: 2,
    orsId: '002',
    site: {
      siteId: 2,
      siteName: 'Paris Paper',
      siteAddress: '2 Rue du Port, Paris, France',
      country: 'France'
    }
  }
]

describe('flattenItems', () => {
  test('gives one row per ORS item and per tonnage item, carrying its request’s fields', () => {
    const rows = flattenItems(
      [
        request('r1', {
          sites: [
            siteItem('item-1'),
            siteItem('item-2', {
              siteId: 2,
              orsId: '002',
              siteName: 'Paris Paper',
              status: 'Queried'
            })
          ]
        }),
        request('r2', {
          submittedAt: null,
          submittedBy: null,
          caseManagementReference: null,
          status: 'InProgress',
          tonnageBandUpgrade: {
            itemId: 'item-3',
            changeType: 'upgrade-tonnage-band',
            status: 'InProgress',
            validFrom: null,
            withdrawnAt: null,
            requestedBand: 'UpTo5000'
          }
        })
      ],
      accreditationSites
    )

    expect(rows).toEqual([
      {
        itemId: 'item-1',
        changeType: 'update-overseas-site',
        status: 'Submitted',
        isTonnage: false,
        siteId: 1,
        siteName: 'Bharat Recycling',
        siteAddress: '1 Industrial Road, India',
        submittedAt: '2027-03-01T11:00:00Z',
        submittedBy: SUBMITTER,
        updatedAt: '2027-03-01T11:00:00Z',
        reference: 'CR-r1'
      },
      expect.objectContaining({
        itemId: 'item-2',
        status: 'Queried',
        siteName: 'Paris Paper',
        // Older ORS records carry only the flattened siteAddress.
        siteAddress: '2 Rue du Port, France'
      }),
      {
        itemId: 'item-3',
        changeType: 'upgrade-tonnage-band',
        status: 'InProgress',
        isTonnage: true,
        siteId: null,
        siteName: null,
        siteAddress: null,
        submittedAt: null,
        submittedBy: null,
        updatedAt: '2027-03-01T11:00:00Z',
        reference: null
      }
    ])
  })

  test('gives no rows when there are no requests', () => {
    expect(flattenItems([], accreditationSites)).toEqual([])
  })

  test('still lists an ORS item whose site is no longer on the accreditation, without an address', () => {
    const [row] = flattenItems(
      [request('r1', { sites: [siteItem('item-9', { siteId: 99 })] })],
      accreditationSites
    )

    expect(row).toMatchObject({ itemId: 'item-9', siteAddress: null })
  })
})

describe('sortItems', () => {
  const row = (itemId, status, submittedAt, updatedAt = submittedAt) => ({
    itemId,
    status,
    submittedAt,
    updatedAt
  })
  const ids = (rows) => rows.map((r) => r.itemId)

  test('puts the statuses needing attention first, in the agreed order', () => {
    const date = '2027-03-01T09:00:00Z'
    const rows = [
      row('withdrawn', 'Withdrawn', date),
      row('refused', 'Rejected', date),
      row('granted', 'Approved', date),
      row('duly-made', 'DulyMade', date),
      row('updated', 'Updated', date),
      row('submitted', 'Submitted', date),
      row('in-progress', 'InProgress', null, date),
      row('queried', 'Queried', date)
    ]

    expect(ids(sortItems(rows))).toEqual([
      'queried',
      'in-progress',
      'submitted',
      'updated',
      'duly-made',
      'granted',
      'refused',
      'withdrawn'
    ])
  })

  test('orders items with the same status by submitted date, newest first', () => {
    const rows = [
      row('march', 'Submitted', '2027-03-01T09:00:00Z', '2027-09-01T09:00:00Z'),
      row('may', 'Submitted', '2027-05-01T09:00:00Z', '2027-05-01T09:00:00Z'),
      row('april', 'Submitted', '2027-04-01T09:00:00Z', '2027-04-01T09:00:00Z')
    ]

    expect(ids(sortItems(rows))).toEqual(['may', 'april', 'march'])
  })

  test('orders in progress items, which have no submitted date, by last updated, newest first', () => {
    const rows = [
      row('older', 'InProgress', null, '2027-02-01T09:00:00Z'),
      row('newer', 'InProgress', null, '2027-06-01T09:00:00Z')
    ]

    expect(ids(sortItems(rows))).toEqual(['newer', 'older'])
  })

  test('puts an unknown status after every known one', () => {
    const date = '2027-03-01T09:00:00Z'

    expect(
      ids(sortItems([row('odd', 'Expired', date), row('w', 'Withdrawn', date)]))
    ).toEqual(['w', 'odd'])
  })

  test('leaves its input unchanged', () => {
    const rows = [
      row('w', 'Withdrawn', '2027-03-01T09:00:00Z'),
      row('q', 'Queried', '2027-03-01T09:00:00Z')
    ]

    sortItems(rows)

    expect(ids(rows)).toEqual(['w', 'q'])
  })
})

describe('changeTypeLabel', () => {
  test.each([
    ['add-overseas-site', 'New ORS accreditation'],
    ['update-overseas-site', 'ORS update'],
    ['upgrade-tonnage-band', 'Tonnage band upgrade'],
    ['remove-overseas-site', 'Change request'],
    [undefined, 'Change request']
  ])('labels %s as "%s"', (changeType, label) => {
    expect(changeTypeLabel(changeType, t)).toBe(label)
  })
})

describe('item status tags', () => {
  test.each([
    ['Queried', 'QUERIED', 'govuk-tag--orange'],
    ['InProgress', 'IN PROGRESS', 'govuk-tag--blue'],
    ['Submitted', 'SUBMITTED', 'govuk-tag--green'],
    ['Updated', 'UPDATED', 'govuk-tag--turquoise'],
    ['DulyMade', 'DULY MADE', 'govuk-tag--turquoise'],
    ['Approved', 'GRANTED', 'govuk-tag--green'],
    ['Rejected', 'REFUSED', 'govuk-tag--red'],
    ['Withdrawn', 'WITHDRAWN', 'govuk-tag--grey']
  ])('shows %s as %s with the shared colour', (status, text, classes) => {
    expect(applicationStatusTag(status, t)).toEqual({ text, classes })
  })
})
