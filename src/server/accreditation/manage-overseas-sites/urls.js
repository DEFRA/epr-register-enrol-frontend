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

// RA-682: the request just submitted, so the page shows that one.
function forRequest(url, requestId) {
  return requestId ? `${url}?request=${encodeURIComponent(requestId)}` : url
}

export function paymentUrl(applicationId, requestId) {
  return forRequest(`${journeyUrl(applicationId)}/payment`, requestId)
}

// RA-682: changing an accredited ORS's details (and its interim sites), keyed
// by the approved application's id and the ORS's site id, as RA-492's pages.
export function updateUrl(applicationId, siteId) {
  return `${journeyUrl(applicationId)}/update/${siteId}`
}

export function updateStepUrl(applicationId, siteId, step) {
  return `${updateUrl(applicationId, siteId)}/details/${step}`
}

export function cancelUpdateUrl(applicationId, siteId) {
  return `${updateUrl(applicationId, siteId)}/cancel`
}

export function newInterimSiteUrl(applicationId, siteId) {
  return `${updateUrl(applicationId, siteId)}/interim-sites/new`
}

export function interimSiteUrl(applicationId, siteId, interimSiteId) {
  return `${updateUrl(applicationId, siteId)}/interim-sites/${interimSiteId}`
}

export function interimSiteAdditionUrl(applicationId, siteId, changeId) {
  return `${updateUrl(applicationId, siteId)}/interim-site-changes/${encodeURIComponent(changeId)}`
}

export function submittedUrl(applicationId, requestId) {
  return forRequest(`${journeyUrl(applicationId)}/submitted`, requestId)
}
