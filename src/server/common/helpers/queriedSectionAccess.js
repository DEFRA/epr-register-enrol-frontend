import { LOCKED_STATUSES } from './accreditationSelection.js'
import { queryTaskListUrl } from './accreditationUrls.js'

// Section statuses that are safe to open read-only when the application is
// Queried but this particular section is not the one the regulator queried.
// NotStarted/InProgress sections have nothing to show and stay blocked.
const VIEWABLE_WHEN_NOT_QUERIED = new Set(['Completed', 'Submitted'])

/**
 * Access decision for a section's GET page, covering both the regulator-query
 * flow and RA-481's locked-status rule. A section stays fully editable
 * whenever its own sectionStatus is 'Queried' — that's true regardless of
 * whether the application itself is 'Queried' (mid-query) or has since moved
 * on to a locked status (e.g. 'Updated') with this one section still
 * outstanding. Otherwise:
 *  - application 'Queried': every other already-answered section can still be
 *    opened read-only from the query task list (mirrors the `viewable`/
 *    `readOnly` logic in query-task-list/controller.js); NotStarted/
 *    InProgress sections stay blocked (nothing to show).
 *  - application in a locked status (Submitted/DulyMade/Updated/
 *    AwaitingDecision): the whole application is read-only, so the section
 *    renders read-only rather than being blocked — GET requests must still
 *    show the page, only writes are refused (see the accreditation-session-
 *    guard plugin and each section's POST handler).
 *  - otherwise: normal, fully editable.
 * @param {object} application - application record from accreditationApiService
 * @param {string} [sectionStatus] - this section's own sectionStatus field
 * @returns {{ blocked: boolean, readOnly: boolean }}
 */
export function resolveQueriedSectionAccess(application, sectionStatus) {
  if (sectionStatus === 'Queried') {
    return { blocked: false, readOnly: false }
  }

  if (application?.applicationStatus === 'Queried') {
    if (VIEWABLE_WHEN_NOT_QUERIED.has(sectionStatus)) {
      return { blocked: false, readOnly: true }
    }
    return { blocked: true, readOnly: false }
  }

  if (LOCKED_STATUSES.has(application?.applicationStatus)) {
    return { blocked: false, readOnly: true }
  }

  return { blocked: false, readOnly: false }
}

// RA-481: every section's POST handler used to inline this exact
// blocked/readOnly decision-and-redirect after its own getApplication call —
// duplicated ~10 lines per file across nine-plus controllers (and the sole
// source of a SonarCloud cognitive/cyclomatic complexity regression across
// all of them). Factored out here so each POST handler calls one function
// instead. Mirrors guardOverseasSiteWizardEntry's "response or null" shape
// (see overseasSiteWizardGuard.js): returns a response to return immediately,
// or null to let the write proceed.
//
// blocked, or read-only because the *application* itself is mid-query and
// this section isn't the one queried, both route back to the query task
// list — same target, same reasoning as the GET controllers' backLink
// (RA-481: a locked-but-not-queried application is read-only for a
// different reason and belongs back on the section's own page instead).
// Plain read-only (e.g. a locked status like Submitted) redirects to
// ownPageUrl so the section re-renders read-only.
/**
 * @param {object} params
 * @param {import('@hapi/hapi').ResponseToolkit} params.h
 * @param {object} params.application - application record from accreditationApiService
 * @param {string} [params.sectionStatus] - this section's own sectionStatus field
 * @param {string} params.applicationId
 * @param {string} params.ownPageUrl - redirect target when locked but not
 *   mid-query (typically request.path, so the page re-fetches read-only)
 * @returns {object|null} a response to return immediately, or null to let
 *   the handler proceed with the write
 */
export function guardSectionWrite({
  h,
  application,
  sectionStatus,
  applicationId,
  ownPageUrl
}) {
  const { blocked, readOnly } = resolveQueriedSectionAccess(
    application,
    sectionStatus
  )
  if (blocked || (readOnly && application?.applicationStatus === 'Queried')) {
    return h.redirect(queryTaskListUrl(applicationId))
  }
  if (readOnly) {
    return h.redirect(ownPageUrl)
  }
  return null
}
