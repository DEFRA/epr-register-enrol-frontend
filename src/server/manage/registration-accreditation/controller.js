import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import {
  naturalNumberLandingUrl,
  reExBackLinkUrl
} from '../../common/helpers/accreditationUrls.js'
import { currentYear, endOfYear } from '../../common/helpers/currentYear.js'
import { fetchChangeRequestsView } from '../helpers/change-requests-view.js'
import { loadManagePage, manageCaption } from '../helpers/manage-page.js'
import { changeRequestsUrl, overseasSitesUrl } from '../helpers/manage-urls.js'
import { offeredApplicationYear } from '../helpers/offered-application-year.js'
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

// RA-765: the URL's own material segment keeps a glass operator's recycling
// process, and its numbers are the ones the apply page's natural-number URL
// takes.
function applyBanner(request, registrationApplications, currentLocale) {
  const year = offeredApplicationYear(registrationApplications, currentYear())
  if (year === null) {
    return null
  }
  const { organisationId, registrationNumber, materialType } = request.params
  return {
    year,
    deadlineYear: year - 1,
    url: naturalNumberLandingUrl(
      {
        organisationNumber: organisationId,
        registrationNumber,
        materialType,
        year
      },
      currentLocale
    )
  }
}

export const manageRegistrationAccreditationController = {
  async handler(request, h) {
    const { context, registrationApplications, t, currentLocale, response } =
      await loadManagePage(request, h, { allowRegistrationOnly: true })
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
        context.reExOrganisationId,
        context.registrationId
      ),
      isRegistrationOnly: context.isRegistrationOnly,
      isExporter: context.isExporter,
      siteAddress: context.siteAddress,
      registrationNumber: context.registrationNumber,
      ...statusSummary(context, t),
      applyBanner: applyBanner(
        request,
        registrationApplications,
        currentLocale
      ),
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
