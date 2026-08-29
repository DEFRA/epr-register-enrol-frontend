// Fallback used wherever the operator has no application context to
// deep-link to (nav bar, submit-confirmation) — the bare operator
// accreditation listing.
export const FALLBACK_HOME_HREF = '/operator-accreditation/'

export function queryTaskListUrl(applicationId) {
  return `/accreditation/query-task-list/${applicationId}`
}

export function queryDeclarationUrl(applicationId) {
  return `/accreditation/query-declaration/${applicationId}`
}

// The "landing page" is the operator-accreditation summary page for this
// specific application — built from the application record itself rather
// than session, since a query-response journey can outlive the session
// values set when the landing page was first visited (RA-339, see also
// the Registration & Accreditation service resubmit duplicate-document fix notes).
//
// There is a single route for both reprocessor and exporter journeys —
// isExporter is a property of the application record, not the URL (RA-374).
export function landingUrl(application) {
  const { organisationId, registrationId, materialType, year } = application
  return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
}
