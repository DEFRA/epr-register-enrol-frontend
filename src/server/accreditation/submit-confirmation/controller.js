import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { buildMaterialDisplay } from '../../common/helpers/material-display.js'

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
    const caseManagementReference = request.yar.get(
      ACCREDITATION_SESSION_KEYS.caseManagementReference
    )

    if (!accreditationReference) {
      return h.redirect(taskListUrl(applicationId))
    }

    let materialType = ''
    let glassRecyclingProcess = null
    try {
      const application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      materialType = application.materialType ?? ''
      glassRecyclingProcess = application.glassRecyclingProcess ?? null
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId} for confirmation: ${err.message}`
      )
    }

    const materialDisplay = materialType
      ? buildMaterialDisplay(materialType, glassRecyclingProcess, t)
      : ''

    return h.view('accreditation/submit-confirmation/index', {
      pageTitle: t('pages.submitConfirmation.title'),
      panelHeading: t('pages.submitConfirmation.panelHeading'),
      panelBodyPrefix: t('pages.submitConfirmation.panelBodyPrefix'),
      panelBodySuffix: t('pages.submitConfirmation.panelBodySuffix'),
      caseReferenceLabel: t('pages.submitConfirmation.caseReferenceLabel'),
      paymentText: t('pages.submitConfirmation.paymentText'),
      viewInvoice: t('pages.submitConfirmation.viewPaymentDetails'),
      returnHome: t('pages.submitConfirmation.returnHome'),
      accreditationReference,
      caseManagementReference,
      materialDisplay,
      applicationId
    })
  }
}
