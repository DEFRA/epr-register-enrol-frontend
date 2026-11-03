import { composeApplicationCaption } from '../../common/helpers/applicationHeader.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import {
  dashboardUrl,
  loadManagePage,
  overseasSitesUrl
} from '../helpers/manage-page.js'

// An accreditation runs to the end of the calendar year it is for. Local time,
// because the formatDate filter formats in local time.
function expiryDate(year) {
  return new Date(year, 11, 31)
}

export const manageRegistrationAccreditationController = {
  async handler(request, h) {
    const { application, registration, t, currentLocale, response } =
      await loadManagePage(request, h)
    if (response) {
      return response
    }

    const heading = t('pages.manageRegistrationAccreditation.heading')

    return h.view('manage/registration-accreditation/index', {
      pageTitle: heading,
      heading,
      caption: composeApplicationCaption({
        operatorName: application.organisationName,
        year: application.year,
        materialType: materialDisplayName(application, t)
      }),
      backLink: dashboardUrl(request.params, currentLocale),
      siteAddress: application.isExporter ? null : application.siteAddress,
      applicationStatusTag: applicationStatusTag(
        application.applicationStatus,
        t
      ),
      accreditationNumber: application.accreditationNumber,
      registrationNumber: registration.registrationNumber,
      expiryDate: expiryDate(application.year),
      overseasSitesUrl: application.isExporter
        ? overseasSitesUrl(request.params, currentLocale)
        : null
    })
  }
}
