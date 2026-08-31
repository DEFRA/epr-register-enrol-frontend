import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import {
  resolveNation,
  buildPaymentDetails,
  buildPaymentReference,
  resolveRegulatorContact
} from '../../common/helpers/paymentDetails.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

function confirmationUrl(applicationId) {
  return `/accreditation/submit-confirmation/${applicationId}`
}

export const viewPaymentDetailsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params

    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        h
          .view('accreditation/view-payment-details/index', {
            pageTitle: t('pages.viewPaymentDetails.title'),
            backLink: confirmationUrl(applicationId),
            backLinkText: t('pages.viewPaymentDetails.backLink'),
            error: t('pages.viewPaymentDetails.loadError')
          })
          .code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const nation = resolveNation(application)

    let paymentDetails
    try {
      paymentDetails = buildPaymentDetails(application, t, nation)
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { applicationId },
        `Error calculating payment details ${applicationId}`
      )
      return h
        .view('accreditation/view-payment-details/index', {
          pageTitle: t('pages.viewPaymentDetails.title'),
          backLink: confirmationUrl(applicationId),
          backLinkText: t('pages.viewPaymentDetails.backLink'),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const materialDisplay = materialDisplayName(application, t)

    const submittedBy = application.submittedBy ?? {}
    const regulatorName =
      paymentDetails.companyName ?? paymentDetails.accountName

    return h.view('accreditation/view-payment-details/index', {
      pageTitle: t('pages.viewPaymentDetails.title'),
      backLink: confirmationUrl(applicationId),
      backLinkText: t('pages.viewPaymentDetails.backLink'),
      materialDisplay,
      submitterName: submittedBy.name ?? '',
      submitterEmail: submittedBy.email ?? '',
      paymentReference: buildPaymentReference(
        nation,
        application.organisationId,
        application.isExporter
      ),
      regulatorName,
      regulatorContact: resolveRegulatorContact(nation),
      paymentDetails
    })
  }
}
