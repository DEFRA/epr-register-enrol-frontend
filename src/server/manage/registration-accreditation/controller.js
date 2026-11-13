import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { endOfYear } from '../../common/helpers/currentYear.js'
import { fetchChangeRequestsView } from '../helpers/change-requests-view.js'
import { loadManagePage, manageCaption } from '../helpers/manage-page.js'
import { changeRequestsUrl, overseasSitesUrl } from '../helpers/manage-urls.js'
import {
  changeTypeLabel,
  flattenItems,
  summariseByType
} from '../change-requests/change-request-items.js'

// RA-697: null leaves the section out. Following RA-492's overseas-sites
// page, an outage of the change requests never takes the dashboard down, and
// an empty state then would wrongly say nothing is in flight.
async function changeRequestsSection(request, context, t, currentLocale) {
  const view = await fetchChangeRequestsView(request, context)
  if (!view) {
    return null
  }

  const listUrl = changeRequestsUrl(request.params, currentLocale)
  return {
    listUrl,
    rows: summariseByType(flattenItems(view.requests ?? [])).map(
      ({ changeType, status }) => ({
        changeType,
        typeLabel: changeTypeLabel(changeType, t),
        statusTag: applicationStatusTag(status, t),
        viewUrl: `${listUrl}?${new URLSearchParams({ type: changeType })}`
      })
    )
  }
}

// RA-697: a registration-only operator has no accreditation number or expiry
// date, so their status is the registration's.
function statusSummary(context, t) {
  const { application } = context
  if (context.isRegistrationOnly) {
    return { statusTag: applicationStatusTag(context.registrationStatus, t) }
  }
  return {
    statusTag: applicationStatusTag(application.applicationStatus, t),
    accreditationNumber: application.accreditationNumber,
    expiryDate: endOfYear(application.year)
  }
}

export const manageRegistrationAccreditationController = {
  async handler(request, h) {
    const { context, t, currentLocale, response } = await loadManagePage(
      request,
      h,
      { allowRegistrationOnly: true }
    )
    if (response) {
      return response
    }

    const heading = t('pages.manageRegistrationAccreditation.heading')

    return h.view('manage/registration-accreditation/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(context, t),
      // RA-425: back to the Re/Ex material page that links here.
      backLink: reExBackLinkUrl(
        request.params.organisationId,
        context.registrationId
      ),
      isRegistrationOnly: context.isRegistrationOnly,
      isExporter: context.isExporter,
      siteAddress: context.siteAddress,
      registrationNumber: context.registrationNumber,
      ...statusSummary(context, t),
      changeRequests: await changeRequestsSection(
        request,
        context,
        t,
        currentLocale
      ),
      overseasSitesUrl: overseasSitesUrl(request.params, currentLocale)
    })
  }
}
