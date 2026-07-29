export function queryTaskListUrl(applicationId) {
  return `/accreditation/query-task-list/${applicationId}`
}

export function queryDeclarationUrl(applicationId) {
  return `/accreditation/query-declaration/${applicationId}`
}

// Interstitial confirmation screen shown between query-task-list and
// query-declaration in the resubmit flow only (RA-311, fix 7). Purely
// navigational — no data is mutated on this page.
export function resubmitConfirmUrl(applicationId) {
  return `/accreditation/resubmit-confirm/${applicationId}`
}

// The "landing page" is the operator-accreditation summary page for this
// specific application — built from the application record itself rather
// than session, since a query-response journey can outlive the session
// values set when the landing page was first visited (RA-339, see also
// fix-01-oj-resubmit-duplicate-document.md).
export function landingUrl(application, isExporter) {
  const { organisationId, registrationId, materialType, year } = application
  const base = `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  return isExporter ? `${base}/exporter` : base
}
