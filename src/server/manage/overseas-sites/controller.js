import { activeInterimSites } from '../../common/helpers/interimSites.js'
import {
  dashboardUrl,
  loadManagePage,
  manageCaption,
  registrationAccreditationUrl,
  serviceProblem
} from '../helpers/manage-page.js'

// Older ORS records carry only the flattened siteAddress, whose first part is
// address line 1.
function addressLine1(site) {
  return site.addressLine1 || site.siteAddress?.split(',')[0].trim() || null
}

// RA-425: withdrawn interim sites are filtered per ORS, so withdrawing a
// shared interim site from one ORS leaves it showing under the others.
function toOrsView(site) {
  return {
    siteId: site.siteId,
    orsId: site.orsId,
    siteName: site.siteName,
    address: [addressLine1(site), site.country].filter(Boolean).join(', '),
    interimSites: activeInterimSites(site)
  }
}

// Accredited: selected on the accreditation. Registered: every other existing
// ORS. A new site that was never selected is on neither. Unlike the
// application journey, an ORS with no selected value is not accredited: on an
// issued accreditation only an explicit selection counts.
function partitionSites(sites) {
  const accredited = []
  const registered = []
  for (const site of sites) {
    if (site.selected === true) {
      accredited.push(toOrsView(site))
    } else if (!site.isNewSite) {
      registered.push(toOrsView(site))
    }
  }
  return { accredited, registered }
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

    const heading = t('pages.manageOverseasSites.heading')
    const { accredited, registered } = partitionSites(sites)

    return h.view('manage/overseas-sites/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(application, t),
      year: application.year,
      backLink: registrationAccreditationUrl(request.params, currentLocale),
      homeUrl: dashboardUrl(request.params, currentLocale),
      accreditedSites: accredited,
      registeredSites: registered
    })
  }
}
