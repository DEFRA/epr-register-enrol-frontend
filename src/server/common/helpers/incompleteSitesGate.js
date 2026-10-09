import { resolveQueriedSectionAccess } from './queriedSectionAccess.js'
import {
  INCOMPLETE_SITES_FLASH,
  findIncompleteSites
} from './overseasSiteCompleteness.js'

// Every point that moves the application on past the overseas sites section -
// confirming the section, submitting the application, resubmitting it after a
// query - turns the operator back to the site list when a site in the
// application is missing required details. The list then names each site and
// links to its Change page. One function, so the points cannot drift apart.
//
// Only when the operator can edit the sites right now. If the section is
// read-only (a locked application, or a query about some other section), a
// site that is incomplete from before could not be fixed, and turning the
// operator back would leave them stuck.

/**
 * @param {object} params
 * @param {import('@hapi/hapi').Request} params.request
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 * @param {(key: string) => string} params.t
 * @param {object} params.application - application record
 * @param {string} params.applicationId
 * @returns {object|null} a redirect to return immediately, or null to proceed
 */
export function redirectIfSitesIncomplete({
  request,
  h,
  t,
  application,
  applicationId
}) {
  const { blocked, readOnly } = resolveQueriedSectionAccess(
    application,
    application.overseasSites?.sectionStatus
  )
  if (blocked || readOnly) {
    return null
  }

  const incomplete = findIncompleteSites(
    t,
    application.overseasSites?.sites,
    application.materialType
  )
  if (incomplete.length === 0) {
    return null
  }

  request.yar.flash(INCOMPLETE_SITES_FLASH, true)
  return h.redirect(`/accreditation/select-overseas-sites/${applicationId}`)
}
