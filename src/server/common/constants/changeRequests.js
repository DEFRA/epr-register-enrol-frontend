// RA-697: the backend's in-year change request item types and statuses
// (AccreditationChangeRequest and ChangeItemStatus).
export const CHANGE_TYPES = {
  addOverseasSite: 'add-overseas-site',
  updateOverseasSite: 'update-overseas-site',
  upgradeTonnageBand: 'upgrade-tonnage-band'
}

// Not yet granted (Approved), refused (Rejected) or withdrawn: the item still
// holds its site, so the site is pending and cannot be added again.
export const ACTIVE_ITEM_STATUSES = new Set([
  'Queried',
  'InProgress',
  'Submitted',
  'Updated',
  'DulyMade'
])
