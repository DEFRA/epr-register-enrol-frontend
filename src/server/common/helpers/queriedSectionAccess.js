import { LOCKED_STATUSES } from './accreditationSelection.js'

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
