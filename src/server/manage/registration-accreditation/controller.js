import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import {
  loadManagePage,
  manageCaption,
  overseasSitesUrl
} from '../helpers/manage-page.js'

// An accreditation runs to the end of the calendar year it is for. Local time,
// because the formatDate filter formats in local time.
const DECEMBER = 11 // Date months count from 0
const LAST_DAY_OF_DECEMBER = 31

function expiryDate(year) {
  return new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER)
}

export const manageRegistrationAccreditationController = {
  async handler(request, h) {
    const { application, registration, t, currentLocale, response } =
      await loadManagePage(request, h)
    if (response) {
      return response
    }

    const { organisationId, registrationId } = request.params
    const heading = t('pages.manageRegistrationAccreditation.heading')

    return h.view('manage/registration-accreditation/index', {
      pageTitle: heading,
      heading,
      caption: manageCaption(application, t),
      // RA-425: back to the Re/Ex material page that links here.
      backLink: reExBackLinkUrl(organisationId, registrationId),
      isExporter: application.isExporter,
      siteAddress: application.siteAddress,
      applicationStatusTag: applicationStatusTag(
        application.applicationStatus,
        t
      ),
      accreditationNumber: application.accreditationNumber,
      registrationNumber: registration.registrationNumber,
      expiryDate: expiryDate(application.year),
      overseasSitesUrl: overseasSitesUrl(request.params, currentLocale)
    })
  }
}
