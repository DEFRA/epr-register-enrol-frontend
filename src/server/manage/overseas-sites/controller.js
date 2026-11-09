import { activeInterimSites } from '../../common/helpers/interimSites.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  changeRequestsSummary,
  registeredSiteActions
} from '../../accreditation/manage-overseas-sites/view-model.js'
import { requestsUrl } from '../../accreditation/manage-overseas-sites/urls.js'
import { fetchChangeRequestsView } from '../helpers/change-requests-view.js'
import {
  loadManagePage,
  manageCaption,
  serviceProblem
} from '../helpers/manage-page.js'
import { manageUrl } from '../helpers/manage-urls.js'
import { orsAddressLine } from '../../common/helpers/orsAddress.js'

// RA-425: withdrawn interim sites are filtered per ORS, so withdrawing a
// shared interim site from one ORS leaves it showing under the others.
// Interim sites belong to the accreditation, so a registered-only ORS shows
// none, even if its registration lists some (Figma's Registered tab has none).
function toOrsView(site, { withInterimSites }) {
  return {
    siteId: site.siteId,
    orsId: site.orsId,
    siteName: site.siteName,
    address: orsAddressLine(site),
    interimSites: withInterimSites ? activeInterimSites(site) : []
  }
}

// RA-492: where a registered ORS stands in the in-year change requests.
// RA-697: applicationId is null for registration only.
function registeredSiteView(site, applicationId, changeRequests) {
  const view = toOrsView(site, { withInterimSites: false })
  if (!changeRequests) {
    return view
  }
  const status = changeRequests.pendingRequestStatus(site.siteId)
  return {
    ...view,
    ...registeredSiteActions(
      applicationId,
      site.siteId,
      status,
      changeRequests.isInDraftRequest(site.siteId)
    )
  }
}

// Accredited: selected on the accreditation. Registered: every other existing
// ORS. A new site that was never selected is on neither. Unlike the
// application journey, an ORS with no selected value is not accredited: on an
// issued accreditation only an explicit selection counts.
// RA-492: with the change requests, each registered ORS offers "Add to
// accreditation"; one in the draft request shows "In progress" and View, and
// one in a submitted request shows "Pending" and no action (AC09). It stays on
// the Registered tab until the regulator approves it. Without them the rows
// are RA-425's alone.
function partitionSites(sites, applicationId, changeRequests) {
  const isAccredited = (site) => site.selected === true
  return {
    accredited: sites
      .filter(isAccredited)
      .map((site) => toOrsView(site, { withInterimSites: true })),
    registered: sites
      .filter((site) => !isAccredited(site) && !site.isNewSite)
      .map((site) => registeredSiteView(site, applicationId, changeRequests))
  }
}

// RA-492: the in-year change pages under /accreditation/ read the
// accreditation from the session, as they do after the operator-accreditation
// landing page, which this page's journey does not pass through.
function enterAccreditationSession(request, application) {
  const { organisationId, registrationId, materialType } = request.params
  request.yar.set(
    ACCREDITATION_SESSION_KEYS.accreditationId,
    application.applicationId
  )
  request.yar.set(ACCREDITATION_SESSION_KEYS.organisationId, organisationId)
  request.yar.set(ACCREDITATION_SESSION_KEYS.registrationId, registrationId)
  request.yar.set(ACCREDITATION_SESSION_KEYS.materialType, materialType)
  request.yar.set(ACCREDITATION_SESSION_KEYS.year, application.year)
}

// RA-492: without the change requests the page shows RA-425's view without
// RA-492's actions, tags or banners, so an outage of the change requests
// never takes down the list of sites.
async function accreditedSites(request, context) {
  const { application } = context
  // The backend always sends overseasSites for an Approved exporter
  // accreditation, so without it the data is incomplete, and empty tabs
  // would pass that off as a complete list.
  if (!Array.isArray(application.overseasSites?.sites)) {
    request.logger.warn(
      { applicationId: application.applicationId },
      'Current accreditation has no overseas sites'
    )
    return null
  }
  const view = await fetchChangeRequestsView(request, context)
  // Set either way: the RA-492 pages handle their own errors.
  enterAccreditationSession(request, application)
  const changeRequests = view && changeRequestsSummary(view)
  return {
    changeRequests,
    requestsUrl: requestsUrl(application.applicationId),
    ...partitionSites(
      application.overseasSites.sites,
      application.applicationId,
      changeRequests
    )
  }
}

// RA-697: the registration view holds the sites as well as the change
// requests, so without it there is no list to show. Every ORS in it is
// registered, and none accredited. With no accreditation there is no
// accreditation session for RA-492's pages.
async function registrationOnlySites(request, context) {
  const view = await fetchChangeRequestsView(request, context)
  if (!Array.isArray(view?.sites)) {
    return null
  }
  const changeRequests = changeRequestsSummary(view)
  return {
    changeRequests,
    requestsUrl: null,
    accredited: [],
    registered: view.sites.map((entry) =>
      registeredSiteView(entry.site, null, changeRequests)
    )
  }
}

export const manageOverseasSitesController = {
  async handler(request, h) {
    const { context, t, currentLocale, response } = await loadManagePage(
      request,
      h,
      { exportersOnly: true, allowRegistrationOnly: true }
    )
    if (response) {
      return response
    }

    const sites = context.isRegistrationOnly
      ? await registrationOnlySites(request, context)
      : await accreditedSites(request, context)
    if (!sites) {
      return serviceProblem(request, h, t)
    }

    const { organisationId, registrationId } = request.params
    const heading = t('pages.manageOverseasSites.heading')
    const { accredited, registered, changeRequests } = sites

    return h.view('manage/overseas-sites/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(context, t),
      year: context.year,
      backLink: manageUrl(request.params, currentLocale),
      // RA-425: "home" is the Re/Ex material page.
      homeUrl: reExBackLinkUrl(organisationId, registrationId),
      accreditedSites: accredited,
      registeredSites: registered,
      // RA-492 banners: AC09 pending change, AC10 requests to resume.
      pendingCount: registered.filter((site) => site.pending).length,
      readyForSubmissionCount: changeRequests?.readyForSubmissionCount ?? 0,
      requestsUrl: sites.requestsUrl
    })
  }
}
