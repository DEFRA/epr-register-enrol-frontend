import { reExBackLinkUrl } from '../../common/helpers/accreditationUrls.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { applicationStatusTag } from '../../common/constants/applicationStatusTags.js'
import {
  loadManagePage,
  localePrefix,
  registrationAccreditationUrl
} from '../helpers/manage-page.js'

export const manageDashboardController = {
  async handler(request, h) {
    const { application, registration, t, currentLocale, response } =
      await loadManagePage(request, h)
    if (response) {
      return response
    }

    const { organisationId, registrationId } = request.params
    const heading = materialDisplayName(application, t)

    return h.view('manage/dashboard/index', {
      pageTitle: heading,
      heading,
      backLink: reExBackLinkUrl(organisationId, registrationId),
      registrationNumber: registration.registrationNumber,
      accreditationStatusTag: applicationStatusTag(
        application.applicationStatus,
        t
      ),
      accreditationNumber: application.accreditationNumber,
      manageRegistrationAccreditationUrl: registrationAccreditationUrl(
        request.params,
        currentLocale
      ),
      contactUrl: `${localePrefix(currentLocale)}/contact`
    })
  }
}
