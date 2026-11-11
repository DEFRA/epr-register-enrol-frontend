import { readFileSync } from 'node:fs'
import { describe, test, expect } from 'vitest'

import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import {
  buildPagination,
  changeTypeLabel,
  filterItems,
  filterOptions,
  findItem,
  flattenItems,
  paginate,
  readFilters,
  sortItems,
  summariseByType
} from './change-request-items.js'

const english = JSON.parse(
  readFileSync(
    new URL('../../../locales/en/translation.json', import.meta.url),
    'utf-8'
  )
)
const t = (key, values = {}) =>
  (key.split('.').reduce((node, part) => node?.[part], english) ?? key).replace(
    /{{(\w+)}}/g,
    (_, name) => values[name]
  )

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
  test('gives one row per ORS item and per tonnage item, carrying its request’s fields and its own reference', () => {
    const rows = flattenItems(
      [
        request('r1', {
          sites: [
            siteItem('item-1', {
              caseManagementReference: 'IYC-ORS-2027-00001'
            }),
            siteItem('item-2', {
              siteId: 2,
              orsId: '002',
              siteName: 'Paris Paper',
              status: 'Queried',
              caseManagementReference: 'IYC-ORS-2027-00002'
            })
          ]
        }),
        request('r2', {
          submittedAt: null,
          submittedBy: null,
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
        reference: 'IYC-ORS-2027-00001'
      },
      expect.objectContaining({
        itemId: 'item-2',
        status: 'Queried',
        siteName: 'Paris Paper',
        reference: 'IYC-ORS-2027-00002',
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
      [
        request('r1', {
          sites: [siteItem('item-9', { siteId: 99, orsId: '099' })]
        })
      ],
      accreditationSites
    )

    expect(row).toMatchObject({ itemId: 'item-9', siteAddress: null })
  })

  // RA-697: a registration-only item's siteId is its ORS id's integer value,
  // not the accreditation's key for the same ORS.
  test('finds a registration-only item’s site by ORS id', () => {
    const [row] = flattenItems(
      [
        request('r1', {
          sites: [
            siteItem('item-4', {
              siteId: 7,
              orsId: '002',
              siteName: 'Paris Paper'
            })
          ]
        })
      ],
      accreditationSites
    )

    expect(row).toMatchObject({
      itemId: 'item-4',
      siteId: 7,
      siteAddress: '2 Rue du Port, France'
    })
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

describe('paginate', () => {
  const rowsOf = (count) =>
    Array.from({ length: count }, (_, index) => ({
      itemId: `item-${index + 1}`
    }))
  const pageIds = ({ rows }) => rows.map((row) => row.itemId)

  test('gives an empty first page for no rows', () => {
    expect(paginate([], 1)).toEqual({
      rows: [],
      page: 1,
      totalPages: 1,
      totalCount: 0,
      rangeStart: 0,
      rangeEnd: 0
    })
  })

  test('fits 10 rows on one page', () => {
    const result = paginate(rowsOf(10), 1)

    expect(pageIds(result)).toHaveLength(10)
    expect(result).toMatchObject({
      page: 1,
      totalPages: 1,
      totalCount: 10,
      rangeStart: 1,
      rangeEnd: 10
    })
  })

  test('puts the 11th row on a second page', () => {
    const result = paginate(rowsOf(11), 2)

    expect(pageIds(result)).toEqual(['item-11'])
    expect(result).toMatchObject({
      page: 2,
      totalPages: 2,
      totalCount: 11,
      rangeStart: 11,
      rangeEnd: 11
    })
  })

  test.each([
    [1, 1, 10],
    [2, 11, 20],
    [3, 21, 23]
  ])('shows page %s of 23 rows as %s-%s', (page, rangeStart, rangeEnd) => {
    const result = paginate(rowsOf(23), page)

    expect(result).toMatchObject({
      page,
      totalPages: 3,
      totalCount: 23,
      rangeStart,
      rangeEnd
    })
    expect(pageIds(result)[0]).toBe(`item-${rangeStart}`)
    expect(pageIds(result)).toHaveLength(rangeEnd - rangeStart + 1)
  })

  test.each([
    ['a page past the last', 9, 3],
    ['the page from the query string', '2', 2],
    ['page 0', 0, 1],
    ['a negative page', '-1', 1],
    ['a page that is not a number', 'two', 1],
    ['a partly numeric page', '2abc', 1],
    ['a fractional page', '1.5', 1],
    ['a repeated page', ['2', '3'], 1],
    ['no page', undefined, 1]
  ])('clamps %s to a valid page', (_, requested, page) => {
    expect(paginate(rowsOf(23), requested).page).toBe(page)
  })

  test('takes a page size', () => {
    const result = paginate(rowsOf(5), 2, 2)

    expect(pageIds(result)).toEqual(['item-3', 'item-4'])
    expect(result.totalPages).toBe(3)
  })
})

describe('buildPagination', () => {
  const BASE_URL = '/manage/org/reg/Plastic/change-requests'
  const build = (options) =>
    buildPagination({ baseUrl: BASE_URL, t, ...options })

  test('returns null for a single page', () => {
    expect(build({ page: 1, totalPages: 1 })).toBeNull()
  })

  test('links every page, marks the current one and labels the links', () => {
    const pagination = build({ page: 2, totalPages: 3 })

    expect(pagination.items).toEqual(
      [1, 2, 3].map((number) => ({
        number,
        href: `${BASE_URL}?page=${number}`,
        current: number === 2,
        visuallyHiddenText: `Page ${number}`
      }))
    )
    expect(pagination.previous).toEqual({
      href: `${BASE_URL}?page=1`,
      html: 'Previous<span class="govuk-visually-hidden"> page</span>'
    })
    expect(pagination.next).toEqual({
      href: `${BASE_URL}?page=3`,
      html: 'Next<span class="govuk-visually-hidden"> page</span>'
    })
    expect(pagination.landmarkLabel).toBe('Pagination')
  })

  test('has no Previous link on the first page and no Next link on the last', () => {
    const first = build({ page: 1, totalPages: 2 })
    const last = build({ page: 2, totalPages: 2 })

    expect(first.previous).toBeNull()
    expect(first.next.href).toBe(`${BASE_URL}?page=2`)
    expect(last.previous.href).toBe(`${BASE_URL}?page=1`)
    expect(last.next).toBeNull()
  })

  test('keeps both filters in every link', () => {
    const pagination = build({
      page: 2,
      totalPages: 2,
      query: { status: 'Queried', type: 'add-overseas-site' }
    })

    expect(pagination.items.map((item) => item.href)).toEqual([
      `${BASE_URL}?status=Queried&type=add-overseas-site&page=1`,
      `${BASE_URL}?status=Queried&type=add-overseas-site&page=2`
    ])
    expect(pagination.previous.href).toBe(
      `${BASE_URL}?status=Queried&type=add-overseas-site&page=1`
    )
  })

  test('keeps the filter values in every link, leaving out empty ones', () => {
    const pagination = build({
      page: 1,
      totalPages: 2,
      query: { status: 'Queried', type: '', other: undefined }
    })

    expect(pagination.items.map((item) => item.href)).toEqual([
      `${BASE_URL}?status=Queried&page=1`,
      `${BASE_URL}?status=Queried&page=2`
    ])
    expect(pagination.next.href).toBe(`${BASE_URL}?status=Queried&page=2`)
  })
})

describe('readFilters', () => {
  test('keeps a known status and type', () => {
    expect(
      readFilters({ status: 'Queried', type: 'upgrade-tonnage-band' })
    ).toEqual({ status: 'Queried', type: 'upgrade-tonnage-band' })
  })

  test.each([
    ['no query values', {}],
    ['the placeholders', { status: '', type: '' }],
    ['unknown values', { status: 'Expired', type: 'remove-overseas-site' }],
    ['the wrong case', { status: 'queried', type: 'UPGRADE-TONNAGE-BAND' }],
    ['repeated values', { status: ['Queried', 'Submitted'], type: ['a', 'b'] }]
  ])('ignores %s', (_, query) => {
    expect(readFilters(query)).toEqual({ status: null, type: null })
  })

  test('ignores an unknown value without dropping the other filter', () => {
    expect(
      readFilters({ status: 'Expired', type: 'add-overseas-site' })
    ).toEqual({ status: null, type: 'add-overseas-site' })
  })
})

describe('filterItems', () => {
  const rows = [
    {
      itemId: 'queried-add',
      status: 'Queried',
      changeType: 'add-overseas-site'
    },
    {
      itemId: 'queried-update',
      status: 'Queried',
      changeType: 'update-overseas-site'
    },
    {
      itemId: 'submitted-add',
      status: 'Submitted',
      changeType: 'add-overseas-site'
    },
    {
      itemId: 'granted-tonnage',
      status: 'Approved',
      changeType: 'upgrade-tonnage-band'
    }
  ]
  const ids = (filtered) => filtered.map((row) => row.itemId)

  test('keeps every row with no filters', () => {
    expect(ids(filterItems(rows, { status: null, type: null }))).toEqual(
      ids(rows)
    )
  })

  test('filters by status', () => {
    expect(ids(filterItems(rows, { status: 'Queried', type: null }))).toEqual([
      'queried-add',
      'queried-update'
    ])
  })

  test('filters by type', () => {
    expect(
      ids(filterItems(rows, { status: null, type: 'add-overseas-site' }))
    ).toEqual(['queried-add', 'submitted-add'])
  })

  test('filters by status and type together', () => {
    expect(
      ids(filterItems(rows, { status: 'Queried', type: 'add-overseas-site' }))
    ).toEqual(['queried-add'])
  })

  test('gives no rows when nothing matches', () => {
    expect(
      filterItems(rows, { status: 'Withdrawn', type: 'add-overseas-site' })
    ).toEqual([])
  })

  test('leaves its input unchanged', () => {
    const input = [...rows]
    filterItems(input, { status: 'Queried', type: null })
    expect(input).toEqual(rows)
  })
})

describe('filterOptions', () => {
  const texts = (options) => options.map((option) => option.text)

  test('offers a placeholder then every status in sort order', () => {
    const { status } = filterOptions({ status: null, type: null }, t)

    expect(texts(status)).toEqual([
      'Select status',
      'Queried',
      'In progress',
      'Submitted',
      'Updated',
      'Duly made',
      'Granted',
      'Refused',
      'Withdrawn'
    ])
    expect(status.map((option) => option.value)).toEqual([
      '',
      'Queried',
      'InProgress',
      'Submitted',
      'Updated',
      'DulyMade',
      'Approved',
      'Rejected',
      'Withdrawn'
    ])
  })

  test('offers a placeholder then every type', () => {
    const { type } = filterOptions({ status: null, type: null }, t)

    expect(type).toEqual([
      { value: '', text: 'Select type', selected: true },
      {
        value: 'add-overseas-site',
        text: 'New ORS accreditation',
        selected: false
      },
      { value: 'update-overseas-site', text: 'ORS update', selected: false },
      {
        value: 'upgrade-tonnage-band',
        text: 'Tonnage band upgrade',
        selected: false
      }
    ])
  })

  test('selects the active filters', () => {
    const { status, type } = filterOptions(
      { status: 'DulyMade', type: 'update-overseas-site' },
      t
    )
    const selected = (options) =>
      options.filter((option) => option.selected).map((option) => option.value)

    expect(selected(status)).toEqual(['DulyMade'])
    expect(selected(type)).toEqual(['update-overseas-site'])
  })
})

describe('summariseByType', () => {
  const row = (changeType, status) => ({ changeType, status })

  test('gives each type its highest-priority active status, in type order', () => {
    expect(
      summariseByType([
        row('upgrade-tonnage-band', 'DulyMade'),
        row('update-overseas-site', 'Submitted'),
        row('update-overseas-site', 'Updated'),
        row('update-overseas-site', 'Queried'),
        row('add-overseas-site', 'Submitted'),
        row('add-overseas-site', 'InProgress'),
        row('upgrade-tonnage-band', 'Updated')
      ])
    ).toEqual([
      { changeType: 'add-overseas-site', status: 'InProgress' },
      { changeType: 'update-overseas-site', status: 'Queried' },
      { changeType: 'upgrade-tonnage-band', status: 'Updated' }
    ])
  })

  test('ignores final items, even when they outnumber the active ones', () => {
    expect(
      summariseByType([
        row('update-overseas-site', 'Approved'),
        row('update-overseas-site', 'Rejected'),
        row('update-overseas-site', 'DulyMade'),
        row('update-overseas-site', 'Withdrawn')
      ])
    ).toEqual([{ changeType: 'update-overseas-site', status: 'DulyMade' }])
  })

  test('gives no entry to a type whose items are all final', () => {
    expect(
      summariseByType([
        row('add-overseas-site', 'Approved'),
        row('add-overseas-site', 'Rejected'),
        row('upgrade-tonnage-band', 'Withdrawn'),
        row('update-overseas-site', 'Submitted')
      ])
    ).toEqual([{ changeType: 'update-overseas-site', status: 'Submitted' }])
  })

  test('is empty with no items, or only final ones', () => {
    expect(summariseByType([])).toEqual([])
    expect(
      summariseByType([
        row('add-overseas-site', 'Approved'),
        row('upgrade-tonnage-band', 'Rejected')
      ])
    ).toEqual([])
  })

  test('lists a type it does not know after the known ones', () => {
    expect(
      summariseByType([
        row('remove-overseas-site', 'Submitted'),
        row('upgrade-tonnage-band', 'Submitted')
      ])
    ).toEqual([
      { changeType: 'upgrade-tonnage-band', status: 'Submitted' },
      { changeType: 'remove-overseas-site', status: 'Submitted' }
    ])
  })
})

describe('findItem', () => {
  const ors = { itemId: 'aaaaaaaa-0000-4000-8000-000000000001', siteId: 1 }
  const tonnage = { itemId: 'aaaaaaaa-0000-4000-8000-000000000002' }
  const requests = [
    { requestId: 'r2', sites: [], tonnageBandUpgrade: tonnage },
    { requestId: 'r1', sites: [ors], tonnageBandUpgrade: null }
  ]

  test('finds an ORS item and its request', () => {
    expect(findItem(requests, ors.itemId)).toEqual({
      request: requests[1],
      item: ors,
      isTonnage: false
    })
  })

  test('finds a tonnage band upgrade item and its request', () => {
    expect(findItem(requests, tonnage.itemId)).toEqual({
      request: requests[0],
      item: tonnage,
      isTonnage: true
    })
  })

  test('ignores the case of the id', () => {
    expect(findItem(requests, ors.itemId.toUpperCase())?.item).toBe(ors)
  })

  test('returns null for an unknown id', () => {
    expect(
      findItem(requests, 'aaaaaaaa-0000-4000-8000-000000000009')
    ).toBeNull()
  })
})
