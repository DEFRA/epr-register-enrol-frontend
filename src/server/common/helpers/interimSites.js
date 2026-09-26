/**
 * RA-603. Reading an overseas reprocessing site's interim sites.
 *
 * An ORS used to hold at most one, in a singular `interimSite`. It can hold
 * many now, in `interimSites`, and withdrawing one leaves it in the record with
 * a `removedAt` stamp rather than deleting it (AC05), so "the interim sites on
 * this ORS" and "the interim sites to show the operator" are no longer the same
 * question.
 *
 * Mirrors the backend's `InterimSiteSync`: the list is authoritative, the
 * singular field is a fallback for a document written before RA-603, and that
 * order matters. The singular field is a mirror the backend maintains, so it can
 * lag the list — rebuilding from it would be a downgrade rather than a fallback.
 */

/**
 * Every interim site on an ORS, withdrawn ones included, in list order.
 *
 * Reads `interimSites` when it has anything, otherwise wraps the legacy
 * singular field. Pure: never mutates the site.
 *
 * @param {object} site
 * @returns {object[]} possibly empty, never null
 */
export function allInterimSites(site) {
  const source = site ?? {}
  if (Array.isArray(source.interimSites) && source.interimSites.length > 0) {
    return source.interimSites
  }
  return source.interimSite ? [source.interimSite] : []
}

/**
 * The interim sites the operator currently has: everything not withdrawn.
 *
 * This is what the page lists and what the "Show interim sites (n)" count
 * counts. A withdrawn site is deliberately excluded rather than greyed out —
 * AC05 keeps it for reporting, not for display.
 */
export function activeInterimSites(site) {
  return allInterimSites(site).filter(
    (interimSite) => interimSite?.removedAt == null
  )
}

/**
 * The interim sites the operator has withdrawn.
 *
 * Only used to offer them back (RA-603 C4). Everything else on the page works
 * from {@link activeInterimSites}.
 */
export function withdrawnInterimSites(site) {
  return allInterimSites(site).filter(
    (interimSite) => interimSite?.removedAt != null
  )
}

/**
 * Finds one interim site by its OWN id, along with the ORS carrying it.
 *
 * Interim site ids are unique application-wide — the backend allocates ORS and
 * interim ids from one sequence — so an interim site can be addressed on its
 * own without also naming its parent. That is what lets the edit, withdraw and
 * restore routes take a single id instead of a composite key.
 *
 * @param {object[]} sites - the application's overseas sites
 * @param {number} interimSiteId
 * @returns {{ site: object, interimSite: object }|null}
 */
export function findInterimSite(sites, interimSiteId) {
  for (const site of sites ?? []) {
    const interimSite = allInterimSites(site).find(
      (candidate) => candidate?.siteId === interimSiteId
    )
    if (interimSite) {
      return { site, interimSite }
    }
  }
  return null
}
