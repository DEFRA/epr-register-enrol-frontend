import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

// RA-459: /operator is a test-only page, so wherever the app would send an
// operator "back" or "home" it lands them on the real Re-Ex frontend instead.
// With an organisation + registration id (from the URL or the accreditation
// session) this deep-links to Re-Ex's own registration page — the same shape
// as an operator-accreditation URL — otherwise it falls back to the bare
// Re-Ex base URL.
export function reExBackLinkUrl(organisationId, registrationId) {
  const base = config.get('reex.frontendBaseUrl')
  if (organisationId && registrationId) {
    return `${base}/organisations/${organisationId}/registrations/${registrationId}`
  }
  return base
}

// Same as reExBackLinkUrl, resolving the ids from the accreditation session —
// used by the journey's error pages, which have no application record to hand.
export function reExBackLinkFromSession(yar) {
  return reExBackLinkUrl(
    yar.get(ACCREDITATION_SESSION_KEYS.organisationId),
    yar.get(ACCREDITATION_SESSION_KEYS.registrationId)
  )
}

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
// fix-01-oj-resubmit-duplicate-document.md).
//
// There is a single route for both reprocessor and exporter journeys —
// isExporter is a property of the application record, not the URL (RA-374).
export function landingUrl(application) {
  const { organisationId, registrationId, materialType, year } = application
  return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
}
