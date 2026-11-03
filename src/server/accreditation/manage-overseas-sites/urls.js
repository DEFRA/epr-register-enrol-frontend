// RA-492: in-year "add a registered ORS to a granted accreditation" journey.
// Every page is keyed by the APPROVED application's id.

export function manageOverseasSitesUrl(applicationId) {
  return `/accreditation/manage-overseas-sites/${applicationId}`
}

export function registeredSitesUrl(applicationId) {
  return `${manageOverseasSitesUrl(applicationId)}#registered`
}

export function addSiteToRequestUrl(applicationId, siteId) {
  return `${manageOverseasSitesUrl(applicationId)}/sites/${siteId}`
}

export function addToAccreditationUrl(applicationId, siteId) {
  return `${manageOverseasSitesUrl(applicationId)}/add/${siteId}`
}

export function stepUrl(applicationId, siteId, step) {
  return `${addToAccreditationUrl(applicationId, siteId)}/${step}`
}

export function besEvidenceFileDeleteUrl(applicationId, siteId, fileId) {
  return stepUrl(
    applicationId,
    siteId,
    `bes-evidence/${encodeURIComponent(fileId)}/delete`
  )
}

export function requestsUrl(applicationId) {
  return `${manageOverseasSitesUrl(applicationId)}/requests`
}

export function declarationUrl(applicationId) {
  return `${manageOverseasSitesUrl(applicationId)}/declaration`
}

export function paymentUrl(applicationId) {
  return `${manageOverseasSitesUrl(applicationId)}/payment`
}
