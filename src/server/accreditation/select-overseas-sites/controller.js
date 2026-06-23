import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function confirmOverseasSitesUrl(applicationId) {
  return `/accreditation/confirm-overseas-sites/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/select-overseas-sites/index', viewData)
}

function buildViewData(t, applicationId, sites, error) {
  return {
    pageTitle: t('pages.selectOverseasSites.title'),
    heading: t('pages.selectOverseasSites.heading'),
    sites,
    backLink: taskListUrl(applicationId),
    error
  }
}

function normaliseSites(rawSites) {
  return (rawSites ?? []).map((s) => ({ ...s, selected: s.selected !== false }))
}

function parseSelectedIds(rawValue) {
  if (!rawValue) return new Set()
  const arr = Array.isArray(rawValue) ? rawValue : [rawValue]
  return new Set(arr.map(Number))
}

export const selectOverseasSitesGetController = {
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
          t('pages.selectOverseasSites.loadError')
        )
      ).code(500)
    }

    const sites = normaliseSites(application.overseasSites?.sites)

    return renderPage(h, buildViewData(t, applicationId, sites, null))
  }
}

export const selectOverseasSitesPostController = {
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
          t('pages.selectOverseasSites.loadError')
        )
      ).code(500)
    }

    const rawSites = application.overseasSites?.sites ?? []
    const selectedIds = parseSelectedIds(request.payload?.siteIds)

    if (selectedIds.size === 0) {
      const sites = rawSites.map((s) => ({ ...s, selected: false }))
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          sites,
          t('pages.selectOverseasSites.validation.noSitesSelected')
        )
      ).code(400)
    }

    const updatedSites = rawSites.map((s) => ({
      ...s,
      selected: selectedIds.has(s.siteId)
    }))

    try {
      await accreditationApiService.patchOverseasSites(
        organisationId,
        applicationId,
        { sites: updatedSites }
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving overseas site selection for ${applicationId}: ${err.message}`
      )
      if (!err.status || err.status >= 500) {
        return h
          .view('errors/service-problem', {
            pageTitle: t('common.errors.serviceTitle'),
            retryUrl: request.path
          })
          .code(500)
      }
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          rawSites.map((s) => ({ ...s, selected: selectedIds.has(s.siteId) })),
          t('pages.selectOverseasSites.validation.saveError')
        )
      ).code(400)
    }

    return h.redirect(confirmOverseasSitesUrl(applicationId))
  }
}
