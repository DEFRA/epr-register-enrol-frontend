// RA-697: the backend's in-year change request item types and statuses
// (AccreditationChangeRequest and ChangeItemStatus).
export const CHANGE_TYPES = {
  addOverseasSite: 'add-overseas-site',
  updateOverseasSite: 'update-overseas-site',
  upgradeTonnageBand: 'upgrade-tonnage-band'
}

// A request's own lifecycle status is InProgress or Submitted, the same
// strings as its items'.
export const ITEM_STATUSES = {
  queried: 'Queried',
  inProgress: 'InProgress',
  submitted: 'Submitted',
  updated: 'Updated',
  dulyMade: 'DulyMade',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
}

// Not yet granted (Approved), refused (Rejected) or withdrawn: the item still
// holds its site, so the site is pending and cannot be added again.
export const ACTIVE_ITEM_STATUSES = new Set([
  ITEM_STATUSES.queried,
  ITEM_STATUSES.inProgress,
  ITEM_STATUSES.submitted,
  ITEM_STATUSES.updated,
  ITEM_STATUSES.dulyMade
])

// RA-697: most urgent first, so items needing the operator's input lead.
export const ITEM_STATUS_ORDER = [
  ITEM_STATUSES.queried,
  ITEM_STATUSES.inProgress,
  ITEM_STATUSES.submitted,
  ITEM_STATUSES.updated,
  ITEM_STATUSES.dulyMade,
  ITEM_STATUSES.approved,
  ITEM_STATUSES.rejected,
  ITEM_STATUSES.withdrawn
]
