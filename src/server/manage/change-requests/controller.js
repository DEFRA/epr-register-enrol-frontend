import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { accreditationChangesService } from '../../accreditation/manage-overseas-sites/service.js'
import {
  changeRequestItemUrl,
  changeRequestsUrl,
  loadManagePage,
  manageCaption,
  manageUrl,
  serviceProblem
} from '../helpers/manage-page.js'
import {
  buildPagination,
  changeTypeLabel,
  filterItems,
  filterOptions,
  flattenItems,
  paginate,
  readFilters,
  sortItems
} from './change-request-items.js'

// RA-697: change requests are read only for the current-year accreditation
// that loadManagePage resolves, so a previous year's unapplied requests, kept
// against that year's accreditation, drop off the list at year end.
async function fetchChangeView(request, application) {
  const { organisationId } = request.params
  try {
    return await accreditationChangesService.getView(
      organisationId,
      application.applicationId
    )
  } catch (error) {
    logStructuredError(
      request.logger,
      error,
      { organisationId, applicationId: application.applicationId },
      'Error fetching the accreditation change requests'
    )
    return null
  }
}

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
    const { application, t, currentLocale, response } = await loadManagePage(
      request,
      h
    )
    if (response) {
      return response
    }

    const view = await fetchChangeView(request, application)
    if (!view) {
      return serviceProblem(request, h, t)
    }

    const { params } = request
    const heading = t('pages.manageChangeRequests.heading')
    const listUrl = changeRequestsUrl(params, currentLocale)
    const filters = readFilters(request.query)
    const { rows, page, totalPages, totalCount, rangeStart, rangeEnd } =
      paginate(
        filterItems(
          sortItems(flattenItems(view.requests ?? [], view.sites ?? [])),
          filters
        ),
        request.query.page
      )

    return h.view('manage/change-requests/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(application, t),
      backLink: manageUrl(params, currentLocale),
      // RA-425: "home" is the Re/Ex material page.
      homeUrl: reExBackLinkUrl(params.organisationId, params.registrationId),
      listUrl,
      filterOptions: filterOptions(filters, t),
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
