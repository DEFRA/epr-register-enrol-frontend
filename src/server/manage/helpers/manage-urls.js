import { localePrefix } from '../../common/helpers/localePrefix.js'

// The manage registration and accreditation page, which Re/Ex links to.
// RA-739: by registration number, not ReEx's registration id, so Re/Ex must
// link with the number.
export function manageUrl(
  { organisationId, registrationNumber, materialType },
  currentLocale
) {
  return `${localePrefix(currentLocale)}/manage/${organisationId}/${encodeURIComponent(registrationNumber)}/${materialType}`
}

export function overseasSitesUrl(params, currentLocale) {
  return `${manageUrl(params, currentLocale)}/overseas-sites`
}

export function changeRequestsUrl(params, currentLocale) {
  return `${manageUrl(params, currentLocale)}/change-requests`
}

export function changeRequestItemUrl(params, itemId, currentLocale) {
  return `${changeRequestsUrl(params, currentLocale)}/${encodeURIComponent(itemId)}`
}
