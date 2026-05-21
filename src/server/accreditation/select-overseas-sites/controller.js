import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function confirmOverseasSitesUrl(applicationId) {
  return `/accreditation/confirm-overseas-sites/${applicationId}`
}

export const selectOverseasSitesGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return h
        .view('accreditation/select-overseas-sites/index', {
          pageTitle: t('pages.selectOverseasSites.title'),
          backLink: taskListUrl(applicationId),
          error: t('pages.selectOverseasSites.loadError')
        })
        .code(500)
    }

    const sites = application.overseasSites?.sites ?? []

    return h.view('accreditation/select-overseas-sites/index', {
      pageTitle: t('pages.selectOverseasSites.title'),
      heading: t('pages.selectOverseasSites.heading'),
      sites,
      continueUrl: confirmOverseasSitesUrl(applicationId),
      backLink: taskListUrl(applicationId)
    })
  }
}
