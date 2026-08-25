import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/confirm-overseas-sites/index', viewData)
}

function buildViewData(
  t,
  applicationId,
  sites,
  error,
  readOnly = false,
  isQueriedApplication = false
) {
  return {
    pageTitle: t('pages.confirmOverseasSites.title'),
    heading: t('pages.confirmOverseasSites.heading'),
    sites,
    backLink: selectOverseasSitesUrl(applicationId),
    error,
    readOnly,
    isQueriedApplication
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

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.overseasSites?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const sites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        sites,
        null,
        readOnly,
        application.applicationStatus === 'Queried'
      )
    )
  }
}

export const confirmOverseasSitesPostController = {
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

    const guardRedirect = guardSectionWrite({
      h,
      application,
      sectionStatus: application.overseasSites?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const sites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )

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
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to this page
      // so it re-fetches and renders read-only.
      if (err.status === 409) {
        return h.redirect(request.path)
      }
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
