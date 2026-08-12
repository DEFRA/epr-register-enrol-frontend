// Section statuses that are safe to open read-only when the application is
// Queried but this particular section is not the one the regulator queried.
// NotStarted/InProgress sections have nothing to show and stay blocked.
const VIEWABLE_WHEN_NOT_QUERIED = new Set(['Completed', 'Submitted'])

/**
 * Access decision for a section's GET page while the application is in the
 * regulator-query flow. Editing stays restricted to the one section the
 * regulator queried; every other already-answered section can still be
 * opened read-only from the query task list (mirrors the `viewable`/`readOnly`
 * logic in query-task-list/controller.js, which decides which tasks get a
 * link in the first place).
 * @param {object} application - application record from accreditationApiService
 * @param {string} [sectionStatus] - this section's own sectionStatus field
 * @returns {{ blocked: boolean, readOnly: boolean }}
 */
export function resolveQueriedSectionAccess(application, sectionStatus) {
  if (application.applicationStatus !== 'Queried') {
    return { blocked: false, readOnly: false }
  }
  if (sectionStatus === 'Queried') {
    return { blocked: false, readOnly: false }
  }
  if (VIEWABLE_WHEN_NOT_QUERIED.has(sectionStatus)) {
    return { blocked: false, readOnly: true }
  }
  return { blocked: true, readOnly: false }
}
