import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  resolveNation,
  buildPaymentDetails,
  requirePaymentReference,
  resolveRegulatorContact
} from '../../common/helpers/paymentDetails.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import {
  landingUrl,
  reExBackLinkFromSession
} from '../../common/helpers/accreditationUrls.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { statusCodes } from '../../common/constants/status-codes.js'

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

    let application
    let paymentReference
    let paymentDetails
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      paymentReference = requirePaymentReference(application)
      paymentDetails = buildPaymentDetails(
        application,
        t,
        resolveNation(application)
      )
    } catch (err) {
      // RA-000: never show the application reference, or any other value, in
      // place of a payment reference the backend could not give us.
      logStructuredError(
        request.server.logger,
        err,
        { applicationId, organisationId },
        `Error loading payment details ${applicationId}`
      )
      return h
        .view('accreditation/submit-confirmation/index', {
          pageTitle: t('pages.submitConfirmation.title'),
          error: t('pages.viewPaymentDetails.loadError'),
          returnHome: t('pages.submitConfirmation.returnHome'),
          returnHomeUrl: reExBackLinkFromSession(request.yar)
        })
        .code(statusCodes.internalServerError)
    }

    return h.view('accreditation/submit-confirmation/index', {
      pageTitle: t('pages.submitConfirmation.title'),
      panelHeading: t('pages.submitConfirmation.panelHeading'),
      panelBodyPrefix: t('pages.submitConfirmation.panelBodyPrefix'),
      panelBodySuffix: t('pages.submitConfirmation.panelBodySuffix'),
      paymentText: t('pages.submitConfirmation.paymentText'),
      returnHome: t('pages.submitConfirmation.returnHome'),
      accreditationReference,
      materialDisplay: materialDisplayName(application, t),
      paymentDetails,
      paymentReference,
      regulatorContact: resolveRegulatorContact(resolveNation(application)),
      returnHomeUrl: landingUrl(application)
    })
  }
}
