import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import {
  resolveNation,
  buildPaymentDetails,
  buildPaymentReference,
  resolveRegulatorContact,
  siteNameFromAddress
} from '../../common/helpers/paymentDetails.js'

const VIEW = 'accreditation/view-payment-details/index'
const TITLE_KEY = 'pages.viewPaymentDetails.title'
const BACK_LINK_KEY = 'pages.viewPaymentDetails.backLink'

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
        .view(VIEW, {
          pageTitle: t(TITLE_KEY),
          backLink: confirmationUrl(applicationId),
          backLinkText: t(BACK_LINK_KEY),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const nation = resolveNation(application)

    let paymentDetails
    try {
      paymentDetails = buildPaymentDetails(application, t, nation)
    } catch (err) {
      request.server.logger.error(
        `Error calculating payment details for ${applicationId}: ${err.message}`
      )
      return h
        .view(VIEW, {
          pageTitle: t(TITLE_KEY),
          backLink: confirmationUrl(applicationId),
          backLinkText: t(BACK_LINK_KEY),
          error: t('pages.viewPaymentDetails.loadError')
        })
        .code(500)
    }

    const materialDisplay = materialDisplayName(application, t)

    const submittedBy = application.submittedBy ?? {}
    const regulatorName =
      paymentDetails.companyName ?? paymentDetails.accountName

    return h.view(VIEW, {
      pageTitle: t(TITLE_KEY),
      backLink: confirmationUrl(applicationId),
      backLinkText: t(BACK_LINK_KEY),
      siteName: siteNameFromAddress(application.siteAddress),
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
