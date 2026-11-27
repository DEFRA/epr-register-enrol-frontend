import { readFileSync } from 'node:fs'
import { describe, test, expect } from 'vitest'

import { PAGE_SIZE, buildPagination, paginate } from './pagination.js'

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

test('pages hold 10 rows by default', () => {
  expect(PAGE_SIZE).toBe(10)
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

  test('sets a data-testid only when given one', () => {
    expect(
      build({ page: 1, totalPages: 2, testId: 'sites-pagination' }).attributes
    ).toEqual({ 'data-testid': 'sites-pagination' })
    expect(build({ page: 1, totalPages: 2 })).not.toHaveProperty('attributes')
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
