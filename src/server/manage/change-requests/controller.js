import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { fetchChangeRequestsView } from '../helpers/change-requests-view.js'
import {
  loadManagePage,
  manageCaption,
  serviceProblem
} from '../helpers/manage-page.js'
import {
  changeRequestItemUrl,
  changeRequestsUrl,
  manageUrl
} from '../helpers/manage-urls.js'
import {
  buildPagination,
  changeTypeLabel,
  changeTypesFor,
  filterItems,
  filterOptions,
  flattenItems,
  paginate,
  readFilters,
  sortItems
} from './change-request-items.js'

function toRowView(row, { t, params, currentLocale }) {
  const typeLabel = changeTypeLabel(row.changeType, t)
  return {
    itemId: row.itemId,
    isTonnage: row.isTonnage,
    siteName: row.siteName,
    siteAddress: row.siteAddress,
    typeLabel,
    statusTag: applicationStatusTag(row.status, t),
    viewUrl: changeRequestItemUrl(params, row.itemId, currentLocale),
    // A tonnage upgrade has no site, so its type alone names the row.
    viewHiddenText: row.isTonnage
      ? typeLabel
      : t('pages.manageChangeRequests.viewHidden', {
          type: typeLabel,
          site: row.siteName
        })
  }
}

export const manageChangeRequestsController = {
  async handler(request, h) {
    const { context, t, currentLocale, response } = await loadManagePage(
      request,
      h,
      { allowRegistrationOnly: true }
    )
    if (response) {
      return response
    }

    const view = await fetchChangeRequestsView(request, context)
    if (!view) {
      return serviceProblem(request, h, t)
    }

    const { params } = request
    const heading = t('pages.manageChangeRequests.heading')
    const listUrl = changeRequestsUrl(params, currentLocale)
    const types = changeTypesFor(context)
    const filters = readFilters(request.query, types)
    const { rows, page, totalPages, totalCount, rangeStart, rangeEnd } =
      paginate(
        filterItems(
          sortItems(flattenItems(view.requests ?? [], view.sites ?? [])),
          filters,
          types
        ),
        request.query.page
      )

    return h.view('manage/change-requests/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(context, t),
      backLink: manageUrl(params, currentLocale),
      // RA-425: "home" is the Re/Ex material page.
      homeUrl: reExBackLinkUrl(params.organisationId, params.registrationId),
      listUrl,
      filterOptions: filterOptions(filters, t, types),
      rows: rows.map((row) => toRowView(row, { t, params, currentLocale })),
      // RA-697: the wording copies case management's count line and still
      // needs design or content confirmation.
      countText:
        totalCount > 0
          ? t('pages.manageChangeRequests.showing', {
              start: rangeStart,
              end: rangeEnd,
              total: totalCount
            })
          : null,
      pagination: buildPagination({
        page,
        totalPages,
        baseUrl: listUrl,
        query: filters,
        t
      })
    })
  }
}
