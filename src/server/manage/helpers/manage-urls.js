import { localePrefix } from '../../common/helpers/localePrefix.js'

// The manage registration and accreditation page, which Re/Ex links to.
export function manageUrl(
  { organisationId, registrationId, materialType },
  currentLocale
) {
  return `${localePrefix(currentLocale)}/manage/${organisationId}/${registrationId}/${materialType}`
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
