import { changeRequestItemUrl } from '../../helpers/manage-urls.js'

// RA-698: the operator's response to a queried item, under the item's own
// page (manage/index.js).

export function respondUrl(params, itemId, currentLocale, path = '') {
  const itemUrl = changeRequestItemUrl(params, itemId, currentLocale)
  return path ? `${itemUrl}/${path}` : itemUrl
}

export function interimSiteUrl(
  params,
  itemId,
  interimSiteId,
  currentLocale,
  step = ''
) {
  const path = `interim-sites/${encodeURIComponent(interimSiteId)}`
  return respondUrl(
    params,
    itemId,
    currentLocale,
    step ? `${path}/${step}` : path
  )
}
