/**
 * RA-697: whether a change request item is for a site. A registration-only
 * item's siteId is its ORS id's integer value, which need not be the
 * accreditation's key for the same ORS, so the ORS id is the match whenever
 * the item and the site both have one. As the backend's
 * ChangeRequestRules.IsForSite.
 *
 * @param {{ siteId: number|string, orsId?: string|null }} item
 * @param {{ siteId: number|string, orsId?: string|null }} site
 */
export function isItemForSite(item, site) {
  return item.orsId && site.orsId
    ? String(item.orsId) === String(site.orsId)
    : String(item.siteId) === String(site.siteId)
}
