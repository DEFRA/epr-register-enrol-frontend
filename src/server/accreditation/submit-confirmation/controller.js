import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  resolveNation,
  buildPaymentDetails
} from '../../common/helpers/paymentDetails.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

export const submitConfirmationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const accreditationReference = request.yar.get(
      ACCREDITATION_SESSION_KEYS.accreditationReference
    )

    if (!accreditationReference) {
      return h.redirect(taskListUrl(applicationId))
    }

    let materialDisplay = ''
    let paymentDetails = null
    try {
      const application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      materialDisplay = materialDisplayName(application, t)
      paymentDetails = buildPaymentDetails(
        application,
        t,
        resolveNation(application)
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching payment details for ${applicationId} on confirmation: ${err.message}`
      )
    }

    return h.view('accreditation/submit-confirmation/index', {
      pageTitle: t('pages.submitConfirmation.title'),
      panelHeading: t('pages.submitConfirmation.panelHeading'),
      panelBodyPrefix: t('pages.submitConfirmation.panelBodyPrefix'),
      panelBodySuffix: t('pages.submitConfirmation.panelBodySuffix'),
      paymentText: t('pages.submitConfirmation.paymentText'),
      returnHome: t('pages.submitConfirmation.returnHome'),
      accreditationReference,
      materialDisplay,
      applicationId,
      paymentDetails,
      paymentReference: accreditationReference
    })
  }
}
