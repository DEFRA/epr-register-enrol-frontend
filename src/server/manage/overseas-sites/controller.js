import { activeInterimSites } from '../../common/helpers/interimSites.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { accreditationChangesService } from '../../accreditation/manage-overseas-sites/service.js'
import {
  changeRequestsSummary,
  registeredSiteActions
} from '../../accreditation/manage-overseas-sites/view-model.js'
import { requestsUrl } from '../../accreditation/manage-overseas-sites/urls.js'
import {
  loadManagePage,
  manageCaption,
  manageUrl,
  serviceProblem
} from '../helpers/manage-page.js'

// Older ORS records carry only the flattened siteAddress, whose first part is
// address line 1.
function addressLine1(site) {
  return site.addressLine1 || site.siteAddress?.split(',')[0].trim() || null
}

// RA-425: withdrawn interim sites are filtered per ORS, so withdrawing a
// shared interim site from one ORS leaves it showing under the others.
// Interim sites belong to the accreditation, so a registered-only ORS shows
// none, even if its registration lists some (Figma's Registered tab has none).
function toOrsView(site, { withInterimSites }) {
  return {
    siteId: site.siteId,
    orsId: site.orsId,
    siteName: site.siteName,
    address: [addressLine1(site), site.country].filter(Boolean).join(', '),
    interimSites: withInterimSites ? activeInterimSites(site) : []
  }
}

// Accredited: selected on the accreditation. Registered: every other existing
// ORS. A new site that was never selected is on neither. Unlike the
// application journey, an ORS with no selected value is not accredited: on an
// issued accreditation only an explicit selection counts.
// RA-492: each registered ORS offers "Add to accreditation"; one in the
// draft request shows "In progress" and View, and one in a submitted request
// shows "Pending" and no action (AC09). It stays on the Registered tab until
// the regulator approves it.
function partitionSites(sites, { applicationId, pendingRequestStatus }) {
  const isAccredited = (site) => site.selected === true
  return {
    accredited: sites
      .filter(isAccredited)
      .map((site) => toOrsView(site, { withInterimSites: true })),
    registered: sites
      .filter((site) => !isAccredited(site) && !site.isNewSite)
      .map((site) => ({
        ...toOrsView(site, { withInterimSites: false }),
        ...registeredSiteActions(
          applicationId,
          site.siteId,
          pendingRequestStatus(site.siteId)
        )
      }))
  }
}

// RA-492: the operator's in-year change requests for the accreditation.
// Null when they cannot be retrieved, so the page shows the service-problem
// page rather than offering actions it cannot vouch for.
async function fetchChangeRequests(request, application) {
  const { organisationId } = request.params
  try {
    return changeRequestsSummary(
      await accreditationChangesService.getView(
        organisationId,
        application.applicationId
      )
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

export const manageOverseasSitesController = {
  async handler(request, h) {
    const { application, t, currentLocale, response } = await loadManagePage(
      request,
      h,
      { exportersOnly: true }
    )
    if (response) {
      return response
    }

    // The backend always sends overseasSites for an Approved exporter
    // accreditation, so without it the data is incomplete, and empty tabs
    // would pass that off as a complete list.
    const sites = application.overseasSites?.sites
    if (!Array.isArray(sites)) {
      request.logger.warn(
        { applicationId: application.applicationId },
        'Current accreditation has no overseas sites'
      )
      return serviceProblem(request, h, t)
    }

    const changeRequests = await fetchChangeRequests(request, application)
    if (!changeRequests) {
      return serviceProblem(request, h, t)
    }
    enterAccreditationSession(request, application)

    const { organisationId, registrationId } = request.params
    const heading = t('pages.manageOverseasSites.heading')
    const { accredited, registered } = partitionSites(sites, {
      applicationId: application.applicationId,
      pendingRequestStatus: changeRequests.pendingRequestStatus
    })

    return h.view('manage/overseas-sites/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(application, t),
      year: application.year,
      backLink: manageUrl(request.params, currentLocale),
      // RA-425: "home" is the Re/Ex material page.
      homeUrl: reExBackLinkUrl(organisationId, registrationId),
      accreditedSites: accredited,
      registeredSites: registered,
      // RA-492 banners: AC09 pending change, AC10 requests to resume.
      pendingCount: registered.filter((site) => site.pending).length,
      readyForSubmissionCount: changeRequests.readyForSubmissionCount,
      requestsUrl: requestsUrl(application.applicationId)
    })
  }
}
