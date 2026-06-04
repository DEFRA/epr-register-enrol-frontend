import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

const BANK_DETAILS = {
  sortCode: '30 94 30',
  accountNumber: '00733445',
  accountName: 'Environment Agency',
  amount: '£546'
}

function confirmationUrl(applicationId) {
  return `/accreditation/submit-confirmation/${applicationId}`
}

function siteNameFromAddress(siteAddress) {
  if (!siteAddress) return ''
  return siteAddress.split(',')[0].trim()
}

export const viewInvoiceGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params

    const organisationId = getUser(request)?.id

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId} for invoice: ${err.message}`
      )
      return h
        .view('accreditation/view-invoice/index', {
          pageTitle: t('pages.viewInvoice.title'),
          backLink: confirmationUrl(applicationId),
          error: t('pages.viewInvoice.loadError')
        })
        .code(500)
    }

    const materialDisplay = application.materialType
      ? t(`pages.materialSelection.materials.${application.materialType}`)
      : ''

    const submittedBy = application.submittedBy ?? {}

    return h.view('accreditation/view-invoice/index', {
      pageTitle: t('pages.viewInvoice.title'),
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
