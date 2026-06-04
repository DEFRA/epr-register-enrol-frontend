import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

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

    let materialType = ''
    try {
      const application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      materialType = application.materialType ?? ''
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId} for confirmation: ${err.message}`
      )
    }

    const materialDisplay = materialType
      ? t(`pages.materialSelection.materials.${materialType}`)
      : ''

    Object.values(ACCREDITATION_SESSION_KEYS).forEach((key) =>
      request.yar.clear(key)
    )

    return h.view('accreditation/submit-confirmation/index', {
      pageTitle: t('pages.submitConfirmation.title'),
      panelHeading: t('pages.submitConfirmation.panelHeading'),
      panelBodyPrefix: t('pages.submitConfirmation.panelBodyPrefix'),
      panelBodySuffix: t('pages.submitConfirmation.panelBodySuffix'),
      paymentText: t('pages.submitConfirmation.paymentText'),
      viewInvoice: t('pages.submitConfirmation.viewInvoice'),
      returnHome: t('pages.submitConfirmation.returnHome'),
      accreditationReference,
      materialDisplay,
      applicationId
    })
  }
}
