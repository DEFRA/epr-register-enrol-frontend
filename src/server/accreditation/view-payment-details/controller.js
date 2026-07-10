import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { buildMaterialDisplay } from '../../common/helpers/material-display.js'
import { siteNameFromAddress } from '../../common/helpers/site-name.js'

const BANK_DETAILS = {
  sortCode: '30 94 30',
  accountNumber: '00733445',
  accountName: 'Environment Agency',
  amount: '£546'
}

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

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId} for payment details: ${err.message}`
      )
      return h
        .view('accreditation/view-payment-details/index', {
          pageTitle: t('pages.viewPaymentDetails.title'),
          backLink: confirmationUrl(applicationId),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const materialDisplay = application.materialType
      ? buildMaterialDisplay(
          application.materialType,
          application.glassRecyclingProcess,
          t
        )
      : ''

    const submittedBy = application.submittedBy ?? {}

    return h.view('accreditation/view-payment-details/index', {
      pageTitle: t('pages.viewPaymentDetails.title'),
      backLink: confirmationUrl(applicationId),
      siteName: siteNameFromAddress(application.siteAddress),
      materialDisplay,
      submitterName: submittedBy.name ?? '',
      submitterEmail: submittedBy.email ?? '',
      paymentReference: application.accreditationReference ?? '',
      bankDetails: BANK_DETAILS
    })
  }
}
