import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  landingUrl,
  queryDeclarationUrl,
  queryTaskListUrl
} from '../../common/helpers/accreditationUrls.js'

function renderPage(h, viewData) {
  return h.view('accreditation/resubmit-confirm/index', viewData)
}

// Interstitial confirmation screen in the resubmit flow only:
// query-task-list -> resubmit-confirm (this page) -> query-declaration.
// Purely navigational — "Accept and submit" is a GET link to
// query-declaration, no data is mutated here. The actual resubmit POST
// still happens from query-declaration, as before.
export const resubmitConfirmGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${error.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.resubmitConfirm.title'),
        error: t('pages.resubmitConfirm.loadError'),
        backLink: '/operator-accreditation'
      }).code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    return renderPage(h, {
      pageTitle: t('pages.resubmitConfirm.title'),
      heading: t('pages.resubmitConfirm.heading'),
      body: t('pages.resubmitConfirm.body'),
      backLink: queryTaskListUrl(applicationId),
      continueUrl: queryDeclarationUrl(applicationId)
    })
  }
}
