import { activeInterimSites } from '../../common/helpers/interimSites.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  approvedSiteActions,
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
import { manageUrl, overseasSitesUrl } from '../helpers/manage-urls.js'
import { orsAddressLine } from '../../common/helpers/orsAddress.js'
import {
  buildPagination,
  countText,
  paginate
} from '../../common/helpers/pagination.js'

// RA-425: withdrawn interim sites are filtered per ORS, so withdrawing a
// shared interim site from one ORS leaves it showing under the others.
// RA-495 (user, 2026-11-20): registered ORSs show their interim sites too.
// RA-814: approved (on the accreditation) or registered; a change request
// never changes it.
function toOrsView(site, isApproved) {
  return {
    siteId: site.siteId,
    orsId: site.orsId,
    siteName: site.siteName,
    address: orsAddressLine(site),
    interimSites: activeInterimSites(site),
    isApproved
  }
}

// RA-814: hasActions says whether the Actions cell has anything in it, so the
// template need not list every action a later flow adds.
function withActions(view, actions) {
  return {
    ...view,
    ...actions,
    hasActions: Object.values(actions).some(Boolean)
  }
}

// RA-682: where an approved ORS's change stands. Without the change
// requests view or an accreditation the row has no change tag or action.
function approvedSiteView(site, applicationId, changeRequests) {
  const view = toOrsView(site, true)
  if (!changeRequests || !applicationId) {
    return view
  }
  return withActions(
    view,
    approvedSiteActions(
      applicationId,
      site.siteId,
      changeRequests.pendingRequestStatus(site.siteId),
      changeRequests.isInDraftRequest(site.siteId)
    )
  )
}

// RA-492: where a registered ORS stands in the in-year change requests.
// RA-697: applicationId is null for registration only.
function registeredSiteView(site, applicationId, changeRequests) {
  const view = toOrsView(site, false)
  if (!changeRequests) {
    return view
  }
  const actions = registeredSiteActions(
    applicationId,
    site.siteId,
    changeRequests.pendingRequestStatus(site.siteId),
    changeRequests.isInDraftRequest(site.siteId)
  )
  // RA-698: no ORS can be added while the regulator has a query open.
  return withActions(view, {
    ...actions,
    addUrl: changeRequests.hasOpenQuery ? null : actions.addUrl
  })
}

// RA-814: by ORS ID as a number, so "010" follows "9". A blank or
// non-numeric ORS ID has no place in that order, so those go last, by site ID.
const numericOrsId = (site) =>
  /^\d+$/.test(String(site.orsId ?? '').trim()) ? Number(site.orsId) : null

function byOrsId(a, b) {
  const [left, right] = [numericOrsId(a), numericOrsId(b)]
  if (left !== right) {
    if (left === null) {
      return 1
    }
    if (right === null) {
      return -1
    }
    return left - right
  }
  return a.siteId - b.siteId
}

// Approved: selected on the accreditation. Registered: every other existing
// ORS. A new site that was never selected is not listed. Unlike the
// application journey, an ORS with no selected value is not approved: on an
// issued accreditation only an explicit selection counts.
// RA-492: with the change requests, each registered ORS offers "Add to
// accreditation"; one in the draft request shows "In progress" and View, and
// one in a submitted request shows "Pending" and no action (AC09). It stays
// Registered until the regulator approves it. RA-682: each approved ORS offers
// Change, or shows "Pending", or "In progress" and View, for its own update.
// Without the change requests the rows are RA-425's alone.
function accreditationSites(sites, applicationId, changeRequests) {
  return sites
    .filter((site) => site.selected === true || !site.isNewSite)
    .sort(byOrsId)
    .map((site) =>
      site.selected === true
        ? approvedSiteView(site, applicationId, changeRequests)
        : registeredSiteView(site, applicationId, changeRequests)
    )
}

// RA-492: the in-year change pages under /accreditation/ read the
// accreditation from the session, as they do after the operator-accreditation
// landing page, which this page's journey does not pass through. The
// accreditation's own material, not the URL's: the journey looks it up by our
// material names (Steel), in that case.
function enterAccreditationSession(request, context) {
  const { application, registrationId, materialType, reExOrganisationId } =
    context
  request.yar.set(
    ACCREDITATION_SESSION_KEYS.accreditationId,
    application.applicationId
  )
  request.yar.set(ACCREDITATION_SESSION_KEYS.organisationId, reExOrganisationId)
  request.yar.set(ACCREDITATION_SESSION_KEYS.registrationId, registrationId)
  request.yar.set(ACCREDITATION_SESSION_KEYS.materialType, materialType)
  request.yar.set(ACCREDITATION_SESSION_KEYS.year, application.year)
}

// RA-492: without the change requests the page shows RA-425's view without
// RA-492's actions, tags or banners, so an outage of the change requests
// never takes down the list of sites.
async function accreditationList(request, context) {
  const { application } = context
  // The backend always sends overseasSites for an Approved exporter
  // accreditation, so without it the data is incomplete, and an empty list
  // would pass that off as a complete one.
  if (!Array.isArray(application.overseasSites?.sites)) {
    request.logger.warn(
      { applicationId: application.applicationId },
      'Current accreditation has no overseas sites'
    )
    return null
  }
  const view = await fetchChangeRequestsView(request, context)
  // Set either way: the RA-492 pages handle their own errors.
  enterAccreditationSession(request, context)
  const changeRequests = view && changeRequestsSummary(view)
  return {
    changeRequests,
    requestsUrl: requestsUrl(application.applicationId),
    sites: accreditationSites(
      application.overseasSites.sites,
      application.applicationId,
      changeRequests
    )
  }
}

// RA-697: the registration view holds the sites as well as the change
// requests, so without it there is no list to show. Every ORS in it is
// registered, and none approved. With no accreditation there is no
// accreditation session for RA-492's pages.
async function registrationOnlyList(request, context) {
  const view = await fetchChangeRequestsView(request, context)
  if (!Array.isArray(view?.sites)) {
    return null
  }
  const changeRequests = changeRequestsSummary(view)
  return {
    changeRequests,
    requestsUrl: null,
    sites: view.sites
      .map((entry) => entry.site)
      .sort(byOrsId)
      .map((site) => registeredSiteView(site, null, changeRequests))
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

    const list = context.isRegistrationOnly
      ? await registrationOnlyList(request, context)
      : await accreditationList(request, context)
    if (!list) {
      return serviceProblem(request, h, t)
    }

    const heading = t('pages.manageOverseasSites.heading')
    const { sites, changeRequests } = list
    const readyForSubmissionCount = changeRequests?.readyForSubmissionCount ?? 0
    // RA-814: the list is ordered before it is paged, and the banners count
    // the whole list, so they read the same on every page. The pending count
    // takes approved sites' updates (RA-682) as well as registered sites'
    // additions.
    const pendingCount = sites.filter((site) => site.pending).length
    // User, 2026-11-27: the pending banner gives way to the requests banner,
    // but only where that banner links to the requests. Registration-only
    // operators have no requests page yet, so they keep both.
    const showPendingBanner =
      pendingCount > 0 && !(readyForSubmissionCount > 0 && list.requestsUrl)
    const paged = paginate(sites, request.query.page)
    const pageUrl = overseasSitesUrl(request.params, currentLocale)

    return h.view('manage/overseas-sites/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(context, t),
      year: context.year,
      backLink: manageUrl(request.params, currentLocale),
      // RA-425: "home" is the Re/Ex material page.
      homeUrl: reExBackLinkUrl(
        context.reExOrganisationId,
        context.registrationId
      ),
      sites: paged.rows,
      countText: countText(paged, t),
      pagination: buildPagination({
        page: paged.page,
        totalPages: paged.totalPages,
        baseUrl: pageUrl,
        testId: 'overseas-sites-pagination',
        t
      }),
      // RA-492 banners: AC09 pending change, AC10 requests to resume.
      pendingCount,
      showPendingBanner,
      isRegistrationOnly: context.isRegistrationOnly,
      readyForSubmissionCount,
      requestsUrl: list.requestsUrl
    })
  }
}
