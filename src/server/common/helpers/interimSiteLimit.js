import { config } from '../../../config/config.js'
import { statusCodes } from '../constants/status-codes.js'
import { accreditationApiService } from './accreditationApiService.js'
import { activeInterimSites } from './interimSites.js'

/**
 * RA-603. How many interim sites an overseas reprocessing site may take.
 *
 * With `featureFlags.multipleInterimSitesEnabled` on, any number. With it off,
 * one: an ORS with no active interim site can still be given one, exactly as
 * before RA-603, but an ORS that already has one cannot be given another.
 * Withdrawn sites do not count, so withdrawing the only one frees the slot.
 *
 * The flag has a twin in epr-register-enrol-management-fe, which shows the
 * regulator only the first interim site while it is off. Enforcing the same
 * limit here is what keeps the operator from entering sites the regulator
 * would never see.
 */
export function isMultipleInterimSitesEnabled() {
  return config.get('featureFlags.multipleInterimSitesEnabled') === true
}

/**
 * @param {object} site - an overseas reprocessing site
 * @returns {boolean} whether a new interim site may be added to it
 */
export function canAddInterimSite(site) {
  return (
    isMultipleInterimSitesEnabled() || activeInterimSites(site).length === 0
  )
}

/**
 * {@link canAddInterimSite} against a fresh read of the application, for the
 * points that hold only an ORS id: the ORS check-your-answers page and the
 * interim site create. With the flag on it answers without a fetch.
 *
 * An ORS that is not on the application is allowed through - the write it
 * guards will fail on its own terms, and that failure is the more accurate one.
 *
 * @param {object} params
 * @param {string} params.organisationId
 * @param {string} params.applicationId
 * @param {number} params.siteId - the ORS the interim site would attach to
 * @returns {Promise<boolean>}
 */
export async function siteCanTakeInterimSite({
  organisationId,
  applicationId,
  siteId
}) {
  if (isMultipleInterimSitesEnabled()) {
    return true
  }
  const application = await accreditationApiService.getApplication(
    organisationId,
    applicationId
  )
  const site = application?.overseasSites?.sites?.find(
    (candidate) => candidate.siteId === siteId
  )
  return site ? canAddInterimSite(site) : true
}

/**
 * Thrown when an interim site create is refused by the one-per-ORS limit.
 * Carries a 409 so it takes the same "back to the list" path as the backend's
 * own conflicts: the list is where the operator can see the site that is
 * already there.
 */
export class InterimSiteLimitError extends Error {
  constructor(siteId) {
    super(
      `Overseas site ${siteId} already has an interim site and multiple interim sites are not enabled`
    )
    this.name = 'InterimSiteLimitError'
    this.status = statusCodes.conflict
  }
}
