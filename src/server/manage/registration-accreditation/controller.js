import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import {
  changeRequestsUrl,
  fetchChangeRequestsView,
  loadManagePage,
  manageCaption,
  overseasSitesUrl
} from '../helpers/manage-page.js'
import {
  changeTypeLabel,
  flattenItems,
  summariseByType
} from '../change-requests/change-request-items.js'

// An accreditation runs to the end of the calendar year it is for. Local time,
// because the formatDate filter formats in local time.
const DECEMBER = 11 // Date months count from 0
const LAST_DAY_OF_DECEMBER = 31

function expiryDate(year) {
  return new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER)
}

// RA-697: null leaves the section out. Following RA-492's overseas-sites
// page, an outage of the change requests never takes the dashboard down, and
// an empty state then would wrongly say nothing is in flight.
async function changeRequestsSection(request, application, t, currentLocale) {
  const view = await fetchChangeRequestsView(request, application)
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

// RA-697: a registration-only operator has no accreditation number, expiry
// date or change requests, so their status is the registration's.
async function statusSummary(request, context, t, currentLocale) {
  const { application } = context
  if (context.isRegistrationOnly) {
    return {
      statusTag: applicationStatusTag(context.registrationStatus, t),
      changeRequests: null
    }
  }
  return {
    statusTag: applicationStatusTag(application.applicationStatus, t),
    accreditationNumber: application.accreditationNumber,
    expiryDate: expiryDate(application.year),
    changeRequests: await changeRequestsSection(
      request,
      application,
      t,
      currentLocale
    )
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

    const { organisationId, registrationId } = request.params
    const heading = t('pages.manageRegistrationAccreditation.heading')

    return h.view('manage/registration-accreditation/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(context, t),
      // RA-425: back to the Re/Ex material page that links here.
      backLink: reExBackLinkUrl(organisationId, registrationId),
      isRegistrationOnly: context.isRegistrationOnly,
      isExporter: context.isExporter,
      siteAddress: context.siteAddress,
      registrationNumber: context.registrationNumber,
      ...(await statusSummary(request, context, t, currentLocale)),
      overseasSitesUrl: overseasSitesUrl(request.params, currentLocale)
    })
  }
}
