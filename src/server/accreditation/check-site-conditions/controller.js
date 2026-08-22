import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/check-site-conditions/index', viewData)
}

function buildViewData(t, applicationId, siteId, siteName, error) {
  return {
    pageTitle: t('pages.checkSiteConditions.title'),
    heading: `${t('pages.checkSiteConditions.heading')}`,
    siteName,
    backLink: `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`,
    error
  }
}

export const checkSiteConditionsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId } = request.params
    const siteIdInt = parseInt(siteId, 10)

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
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          siteId,
          '',
          t('pages.checkSiteConditions.loadError')
        )
      ).code(500)
    }

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''

    return renderPage(
      h,
      buildViewData(t, applicationId, siteId, siteName, null)
    )
  }
}

export const checkSiteConditionsPostController = {
  async handler(request, h) {
    const { applicationId } = request.params
    return h.redirect(taskListUrl(applicationId))
  }
}
