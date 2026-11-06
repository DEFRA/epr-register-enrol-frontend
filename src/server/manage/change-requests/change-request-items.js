import nunjucks from 'nunjucks'

import {
  ACTIVE_ITEM_STATUSES,
  CHANGE_TYPES,
  ITEM_STATUS_ORDER
} from '../../common/constants/changeRequests.js'
import { orsAddressLine } from '../helpers/ors-address.js'

// RA-697: screens read each item's own type and status, never the request's,
// because one request's ORS items are decided separately.

function rowFor(request, item, site) {
  return {
    itemId: item.itemId,
    changeType: item.changeType,
    status: item.status,
    ...site,
    submittedAt: request.submittedAt ?? null,
    submittedBy: request.submittedBy ?? null,
    updatedAt: request.updatedAt,
    reference: request.caseManagementReference ?? null
  }
}

const TONNAGE_ROW_SITE = {
  isTonnage: true,
  siteId: null,
  siteName: null,
  siteAddress: null
}

/**
 * ORS rows take their address from the accreditation's sites (`view.sites`)
 * because the items don't copy it.
 */
export function flattenItems(requests, accreditationSites = []) {
  const sitesById = new Map(
    accreditationSites.map((entry) => [String(entry.siteId), entry.site])
  )
  const orsRowSite = (item) => {
    const site = sitesById.get(String(item.siteId))
    return {
      isTonnage: false,
      siteId: item.siteId,
      siteName: item.siteName,
      siteAddress: (site && orsAddressLine(site)) || null
    }
  }
  return requests.flatMap((request) => [
    ...(request.sites ?? []).map((item) =>
      rowFor(request, item, orsRowSite(item))
    ),
    ...(request.tonnageBandUpgrade
      ? [rowFor(request, request.tonnageBandUpgrade, TONNAGE_ROW_SITE)]
      : [])
  ])
}

// An unknown status sorts last rather than first, so it never pushes a
// status needing attention down the list.
const statusRank = (status) => {
  const rank = ITEM_STATUS_ORDER.indexOf(status)
  return rank === -1 ? ITEM_STATUS_ORDER.length : rank
}

// In progress items have never been submitted, so they go by last updated.
const sortTime = (row) => Date.parse(row.submittedAt ?? row.updatedAt) || 0

export function sortItems(rows) {
  return [...rows].sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) || sortTime(b) - sortTime(a)
  )
}

const TYPE_LABEL_KEYS = {
  [CHANGE_TYPES.addOverseasSite]: 'addOverseasSite',
  [CHANGE_TYPES.updateOverseasSite]: 'updateOverseasSite',
  [CHANGE_TYPES.upgradeTonnageBand]: 'upgradeTonnageBand'
}

// Later journeys (such as removing an ORS) add types the pages may not know
// yet; they still get a row.
export function changeTypeLabel(changeType, t) {
  const key = Object.hasOwn(TYPE_LABEL_KEYS, changeType)
    ? TYPE_LABEL_KEYS[changeType]
    : 'other'
  return t(`pages.manageChangeRequests.types.${key}`)
}

export const PAGE_SIZE = 10

// `?page=` isn't validated by the route, so anything that isn't a whole
// number in range lands on the nearest valid page instead of erroring.
function clampPage(requested, totalPages) {
  const page = /^\d+$/.test(String(requested)) ? Number(requested) : 1
  return Math.min(Math.max(page, 1), totalPages)
}

export function paginate(rows, requestedPage, pageSize = PAGE_SIZE) {
  const totalCount = rows.length
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1)
  const page = clampPage(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const pageRows = rows.slice(offset, offset + pageSize)
  return {
    rows: pageRows,
    page,
    totalPages,
    totalCount,
    rangeStart: pageRows.length ? offset + 1 : 0,
    rangeEnd: offset + pageRows.length
  }
}

const PAGINATION_KEYS = 'pages.manageChangeRequests.pagination'

// Ported from case management's work-items list. The labels are passed in
// because the GOV.UK macro's defaults are English only.
export function buildPagination({ page, totalPages, baseUrl, query = {}, t }) {
  if (totalPages <= 1) {
    return null
  }

  const hrefFor = (target) => {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) {
      if (value) {
        params.append(name, value)
      }
    }
    params.append('page', String(target))
    return `${baseUrl}?${params}`
  }

  // RA-697: passing our own label drops the macro's visually hidden " page",
  // so screen readers would hear just "Next". Put it back.
  const { escape } = nunjucks.lib
  const hiddenPage = escape(t(`${PAGINATION_KEYS}.visuallyHiddenPage`))
  const linkHtml = (key) =>
    `${escape(t(`${PAGINATION_KEYS}.${key}`))}<span class="govuk-visually-hidden"> ${hiddenPage}</span>`

  return {
    landmarkLabel: t(`${PAGINATION_KEYS}.landmarkLabel`),
    previous:
      page > 1 ? { href: hrefFor(page - 1), html: linkHtml('previous') } : null,
    next:
      page < totalPages
        ? { href: hrefFor(page + 1), html: linkHtml('next') }
        : null,
    items: Array.from({ length: totalPages }, (_, index) => ({
      number: index + 1,
      href: hrefFor(index + 1),
      current: index + 1 === page,
      visuallyHiddenText: t(`${PAGINATION_KEYS}.page`, { number: index + 1 })
    }))
  }
}

const FILTER_KEYS = 'pages.manageChangeRequests.filters'
const TYPE_ORDER = Object.values(CHANGE_TYPES)
const FILTER_STATUSES = new Set(ITEM_STATUS_ORDER)

/**
 * RA-697: a registration-only operator, with no accreditation, can only have
 * ORS updates.
 */
export function changeTypesFor({ isRegistrationOnly }) {
  return isRegistrationOnly ? [CHANGE_TYPES.updateOverseasSite] : TYPE_ORDER
}

const knownOrNull = (value, known) =>
  typeof value === 'string' && known.has(value) ? value : null

// `?status=` and `?type=` aren't validated by the route, so an unknown value,
// or the placeholder's empty one, just means no filter.
export function readFilters(query = {}, types = TYPE_ORDER) {
  return {
    status: knownOrNull(query.status, FILTER_STATUSES),
    type: knownOrNull(query.type, new Set(types))
  }
}

export function filterItems(rows, filters, types = TYPE_ORDER) {
  const { status, type } = readFilters(filters, types)
  return rows.filter(
    (row) =>
      (!status || row.status === status) && (!type || row.changeType === type)
  )
}

const optionsFor = (values, selected, placeholder, labelFor) => [
  { value: '', text: placeholder, selected: !selected },
  ...values.map((value) => ({
    value,
    text: labelFor(value),
    selected: value === selected
  }))
]

// Status options are sentence case, as in Figma, not the upper-case tag labels.
export function filterOptions({ status, type }, t, types = TYPE_ORDER) {
  return {
    status: optionsFor(
      ITEM_STATUS_ORDER,
      status,
      t(`${FILTER_KEYS}.statusPlaceholder`),
      (value) => t(`${FILTER_KEYS}.statuses.${value}`)
    ),
    type: optionsFor(
      types,
      type,
      t(`${FILTER_KEYS}.typePlaceholder`),
      (value) => changeTypeLabel(value, t)
    )
  }
}

const typeRank = (changeType) => {
  const rank = TYPE_ORDER.indexOf(changeType)
  return rank === -1 ? TYPE_ORDER.length : rank
}

// RA-697: the dashboard shows only work in progress, so final items count for
// nothing, and a type with only final items gets no entry.
export function summariseByType(rows) {
  const byType = new Map()
  for (const row of rows) {
    if (!ACTIVE_ITEM_STATUSES.has(row.status)) {
      continue
    }
    const current = byType.get(row.changeType)
    if (!current || statusRank(row.status) < statusRank(current)) {
      byType.set(row.changeType, row.status)
    }
  }
  return [...byType]
    .map(([changeType, status]) => ({ changeType, status }))
    .sort((a, b) => typeRank(a.changeType) - typeRank(b.changeType))
}

/**
 * RA-697: the item with `itemId` (in any case) and the request holding it,
 * or null. `requests` must be the current-year accreditation's only, so a
 * previous year's item is never found.
 */
export function findItem(requests, itemId) {
  const wanted = String(itemId).toLowerCase()
  const matches = (item) => String(item?.itemId).toLowerCase() === wanted
  for (const request of requests) {
    const site = (request.sites ?? []).find(matches)
    if (site) {
      return { request, item: site, isTonnage: false }
    }
    if (matches(request.tonnageBandUpgrade)) {
      return { request, item: request.tonnageBandUpgrade, isTonnage: true }
    }
  }
  return null
}
