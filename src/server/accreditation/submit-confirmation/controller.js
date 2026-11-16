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

    const viewData = {
      pageTitle: t('pages.submitConfirmation.title'),
      panelHeading: t('pages.submitConfirmation.panelHeading'),
      panelBodyPrefix: t('pages.submitConfirmation.panelBodyPrefix'),
      applicationReferenceLabel: t(
        'pages.submitConfirmation.applicationReferenceLabel'
      ),
      paymentText: t('pages.submitConfirmation.paymentText'),
      returnHome: t('pages.submitConfirmation.returnHome'),
      accreditationReference,
      returnHomeUrl: reExBackLinkFromSession(request.yar)
    }

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      const nation = resolveNation(application)
      return h.view('accreditation/submit-confirmation/index', {
        ...viewData,
        materialDisplay: materialDisplayName(application, t),
        paymentReference: requirePaymentReference(application),
        paymentDetails: buildPaymentDetails(application, t, nation),
        regulatorContact: resolveRegulatorContact(nation),
        returnHomeUrl: landingUrl(application)
      })
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { applicationId, organisationId },
        `Error loading payment details ${applicationId}`
      )
      // RA-000: the submission itself succeeded, so the page still confirms
      // it (200, so nothing reads it as a failed submit to retry). Only the
      // payment details are replaced by an error; no other reference is
      // shown in place of the payment reference.
      return h.view('accreditation/submit-confirmation/index', {
        ...viewData,
        ...(application && {
          materialDisplay: materialDisplayName(application, t),
          returnHomeUrl: landingUrl(application)
        }),
        paymentDetailsError: t('pages.viewPaymentDetails.loadError')
      })
    }
  }
}
