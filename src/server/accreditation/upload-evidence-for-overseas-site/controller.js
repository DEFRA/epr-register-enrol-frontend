import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function uploadUrl(applicationId, siteId) {
  return `/accreditation/upload-bes-evidence/${applicationId}/${siteId}`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/upload-evidence-for-overseas-site/index',
    viewData
  )
}

function mapSites(t, applicationId, rawSites) {
  return (rawSites ?? []).map((s) => ({
    siteId: s.siteId,
    siteName: s.siteName ?? '',
    country: s.country ?? '',
    hasEvidence: (s.besEvidence?.besEvidenceUploads?.length ?? 0) > 0,
    uploadUrl: uploadUrl(applicationId, s.siteId)
  }))
}

function buildViewData(t, applicationId, sites, error) {
  return {
    pageTitle: t('pages.uploadEvidenceList.title'),
    heading: t('pages.uploadEvidenceList.heading'),
    sites,
    backLink: taskListUrl(applicationId),
    error
  }
}

export const uploadEvidenceListGetController = {
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
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          [],
          t('pages.uploadEvidenceList.loadError')
        )
      ).code(500)
    }

    const selectedSites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )
    const sites = mapSites(t, applicationId, selectedSites)
    return renderPage(h, buildViewData(t, applicationId, sites, null))
  }
}

export const uploadEvidenceListPostController = {
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
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          [],
          t('pages.uploadEvidenceList.loadError')
        )
      ).code(500)
    }

    const selectedSites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )
    const sites = mapSites(t, applicationId, selectedSites)

    try {
      await accreditationApiService.patchBesEvidenceSection(
        organisationId,
        applicationId,
        { sectionStatus: 'Completed' }
      )
    } catch (err) {
      request.server.logger.error(
        `Error completing BES evidence section for ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          sites,
          t('pages.uploadEvidenceList.saveError')
        )
      ).code(500)
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
