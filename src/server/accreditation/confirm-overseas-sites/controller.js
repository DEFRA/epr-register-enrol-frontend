import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function confirmUrl(applicationId) {
  return `/accreditation/confirm-overseas-sites/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/confirm-overseas-sites/index', viewData)
}

function buildViewData(t, applicationId, sites, error) {
  return {
    pageTitle: t('pages.confirmOverseasSites.title'),
    heading: t('pages.confirmOverseasSites.heading'),
    sites,
    backLink: selectOverseasSitesUrl(applicationId),
    error
  }
}

export const confirmOverseasSitesGetController = {
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
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          [],
          t('pages.confirmOverseasSites.loadError')
        )
      ).code(500)
    }

    const sites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )

    return renderPage(h, buildViewData(t, applicationId, sites, null))
  }
}

export const confirmOverseasSitesPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction, siteId } = request.payload

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
          [],
          t('pages.confirmOverseasSites.loadError')
        )
      ).code(500)
    }

    const allSites = application.overseasSites?.sites ?? []
    const sites = allSites.filter((s) => s.selected !== false)

    if (submitAction === 'remove') {
      const siteIdInt = parseInt(siteId, 10)
      const updatedSites = allSites.map((s) =>
        s.siteId === siteIdInt ? { ...s, selected: false } : s
      )
      try {
        await accreditationApiService.patchOverseasSites(
          organisationId,
          applicationId,
          { sites: updatedSites }
        )
      } catch (err) {
        request.server.logger.error(
          `Error removing overseas site ${siteId} from ${applicationId}: ${err.message}`
        )
        return renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            sites,
            t('pages.confirmOverseasSites.saveError')
          )
        ).code(500)
      }
      return h.redirect(confirmUrl(applicationId))
    }

    try {
      await accreditationApiService.patchOverseasSites(
        organisationId,
        applicationId,
        { sectionStatus: 'Completed' }
      )
    } catch (err) {
      request.server.logger.error(
        `Error confirming overseas sites for ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          sites,
          t('pages.confirmOverseasSites.saveError')
        )
      ).code(500)
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
