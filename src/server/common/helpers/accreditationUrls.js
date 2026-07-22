import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

export function queryTaskListUrl(applicationId) {
  return `/accreditation/query-task-list/${applicationId}`
}

export function queryDeclarationUrl(applicationId) {
  return `/accreditation/query-declaration/${applicationId}`
}

// The "landing page" is the operator-accreditation summary page for this
// specific application — reconstructed from session values set when that
// page was first visited (RA-311 §3).
export function landingUrl(yar, isExporter) {
  const organisationId = yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
  const registrationId = yar.get(ACCREDITATION_SESSION_KEYS.registrationId)
  const materialType = yar.get(ACCREDITATION_SESSION_KEYS.materialType)
  const year = yar.get(ACCREDITATION_SESSION_KEYS.year)
  const base = `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  return isExporter ? `${base}/exporter` : base
}
