import Boom from '@hapi/boom'

import { ITEM_STATUSES } from '../../../common/constants/changeRequests.js'
import { isItemForSite } from '../../../common/helpers/changeRequestSite.js'
import { fetchChangeRequestsView } from '../../helpers/change-requests-view.js'
import {
  loadManagePage,
  manageCaption,
  serviceProblem
} from '../../helpers/manage-page.js'
import { findItem } from '../change-request-items.js'
import { respondUrl } from './urls.js'

// The backend's names for an ORS's fields, where the site record's differ.
const SITE_FIELD = { rejectedLoadsArrangements: 'repatriatedLoads' }

/**
 * The value of one of the queried ORS's editable fields: the item's own
 * answer over the ORS's value.
 */
export function orsValue(ctx, field) {
  const fromItem = ctx.item.effective?.[field]
  if (fromItem !== undefined && fromItem !== null) {
    return fromItem
  }
  return ctx.entry?.site?.[SITE_FIELD[field] ?? field] ?? ''
}

/** The item's `query` entry for one of the ORS's interim sites, or undefined. */
export function findQueriedInterimSite(item, interimSiteId) {
  return item.query?.interimSites?.find(
    (site) => String(site.siteId) === String(interimSiteId)
  )
}

/**
 * RA-698: what every queried-item page needs, or `{ response }` when the page
 * must not render. A page is for the accredited operator's own Queried ORS
 * item only: anything else (a tonnage item, a registration-only item with no
 * accreditation to answer on, an unknown item) is a 404, and an item that is
 * no longer Queried goes back to its own page, which is read only.
 */
export async function loadQueriedItem(request, h) {
  const { context, t, currentLocale, response } = await loadManagePage(
    request,
    h,
    { allowRegistrationOnly: true }
  )
  if (response) {
    return { response }
  }
  if (context.isRegistrationOnly) {
    throw Boom.notFound()
  }

  const view = await fetchChangeRequestsView(request, context)
  if (!view) {
    return { response: serviceProblem(request, h, t) }
  }
  const found = findItem(view.requests ?? [], request.params.itemId)
  if (!found || found.isTonnage) {
    throw Boom.notFound()
  }

  const { item } = found
  const itemUrl = respondUrl(request.params, item.itemId, currentLocale)
  if (item.status !== ITEM_STATUSES.queried || !item.query) {
    return { response: h.redirect(itemUrl) }
  }

  // The shared step templates caption themselves from here.
  request.app.applicationHeader = { captionText: manageCaption(context, t) }

  return {
    ctx: {
      request,
      t,
      currentLocale,
      context,
      view,
      item,
      entry: view.sites?.find((site) => isItemForSite(item, site)),
      itemUrl,
      params: request.params,
      organisationId: context.reExOrganisationId,
      applicationId: context.application.applicationId
    }
  }
}
