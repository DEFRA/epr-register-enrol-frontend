import {
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
