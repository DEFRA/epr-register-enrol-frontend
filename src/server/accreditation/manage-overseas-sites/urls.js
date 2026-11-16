import { overseasSitesUrl } from '../../manage/helpers/manage-urls.js'

// RA-492: in-year "add a registered ORS to a granted accreditation" journey.
// Every page is keyed by the APPROVED application's id. The journey starts
// from, and returns to, RA-425's Manage overseas reprocessing sites page.

function journeyUrl(applicationId) {
  return `/accreditation/manage-overseas-sites/${applicationId}`
}

/**
 * RA-425's Manage overseas reprocessing sites page for the accreditation in
 * the backend's change view, optionally on its Registered tab. RA-739: the
 * view's registrationReference is the registration number the page's URL
 * carries.
 */
export function manageSitesUrl(
  view,
  currentLocale,
  { registered = false } = {}
) {
  const url = overseasSitesUrl(
    {
      organisationId: view.organisationId,
      registrationNumber: view.registrationReference,
      materialType: view.materialType
    },
    currentLocale
  )
  return registered ? `${url}#registered` : url
}

export function addSiteToRequestUrl(applicationId, siteId) {
  return `${journeyUrl(applicationId)}/sites/${siteId}`
}

export function addToAccreditationUrl(applicationId, siteId) {
  return `${journeyUrl(applicationId)}/add/${siteId}`
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
  return `${journeyUrl(applicationId)}/requests`
}

export function declarationUrl(applicationId) {
  return `${journeyUrl(applicationId)}/declaration`
}

export function paymentUrl(applicationId) {
  return `${journeyUrl(applicationId)}/payment`
}
