import { accreditationApiService } from './accreditationApiService.js'
import { resolveQueriedSectionAccess } from './queriedSectionAccess.js'
import { queryTaskListUrl } from './accreditationUrls.js'

// RA-481: entry guard shared by every step of the add-overseas-site and
// add-interim-site wizards (site-name, site-location, ..., check-your-
// answers). Both wizards hold their draft data in yar session, not on the
// application record, so once the overseasSites section is locked there is
// no existing answer to render read-only — the whole wizard is off-limits
// and the operator is sent back to the section's own list page, which
// renders its own read-only state. A section that's itself Queried stays
// fully usable, same as everywhere else this rule applies.
//
// Fails open (returns null, letting the step render as normal) when the
// application can't be fetched, consistent with the other best-effort
// session-guard fetches in this codebase — the write endpoints these
// wizards eventually reach (createOverseasSite/promoteOverseasSite/
// createInterimSite) are still protected by the backend's own guard.
/**
 * @param {object} params
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 * @param {string} params.organisationId
 * @param {string} params.applicationId
 * @param {string} params.fallbackUrl - where to send the operator when the
 *   wizard can't be used (typically the select-overseas-sites list page)
 * @returns {Promise<object|null>} a response to return immediately, or null
 *   to let the step proceed
 */
export async function guardOverseasSiteWizardEntry({
  h,
  organisationId,
  applicationId,
  fallbackUrl
}) {
  let application
  try {
    application = await accreditationApiService.getApplication(
      organisationId,
      applicationId
    )
  } catch {
    return null
  }

  const { blocked, readOnly } = resolveQueriedSectionAccess(
    application,
    application.overseasSites?.sectionStatus
  )
  if (blocked) {
    return h.redirect(queryTaskListUrl(applicationId))
  }
  if (readOnly) {
    return h.redirect(fallbackUrl)
  }
  return null
}

// RA-486: the add-interim-site wizard is only ever entered via "Save and add
// interim site" on the ORS check-your-answers page, which stashes the
// parent site's id as linkedSiteId in the interim-site session before
// redirecting to the wizard's first step. Without that guard, direct
// navigation to any wizard step (e.g. typing the URL) would walk the whole
// wizard and only fail once it tries to submit — this sends the operator
// back to the section's list page immediately instead.
/**
 * @param {object} params
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 * @param {object} params.session - the add-interim-site session (from
 *   getAddInterimSiteSession)
 * @param {string} params.fallbackUrl - where to send the operator when
 *   there's no linked ORS site to attach the interim site to
 * @returns {object|null} a response to return immediately, or null to let
 *   the step proceed
 */
export function guardInterimSiteLinkedSiteId({ h, session, fallbackUrl }) {
  if (session.linkedSiteId == null) {
    return h.redirect(fallbackUrl)
  }
  return null
}
