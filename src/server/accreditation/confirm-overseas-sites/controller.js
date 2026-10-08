import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import { activeInterimSites } from '../../common/helpers/interimSites.js'
import { isMultipleInterimSitesEnabled } from '../../common/helpers/interimSiteLimit.js'
import { redirectIfSitesIncomplete } from '../../common/helpers/incompleteSitesGate.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

// RA-630: list the interim sites the same way select-overseas-sites does - every
// active one, or only the first while multiple interim sites are off - rather
// than reading the singular `interimSite` mirror, which holds just one.
function decorateSite(site) {
  const active = activeInterimSites(site)
  return {
    ...site,
    interimSites: isMultipleInterimSitesEnabled() ? active : active.slice(0, 1)
  }
}

function selectedSites(application) {
  return (application.overseasSites?.sites ?? [])
    .filter((s) => s.selected !== false)
    .map(decorateSite)
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

// Shared by both controllers below (SonarCloud duplication): the fetch-failure page is
// identical whether the request was a GET or a POST.
function renderFetchErrorPage(h, t, applicationId) {
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

export const confirmOverseasSitesGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () => renderFetchErrorPage(h, t, applicationId)
    })
    if (errorResponse) {
      return errorResponse
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.overseasSites?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const sites = selectedSites(application)

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

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () => renderFetchErrorPage(h, t, applicationId)
    })
    if (errorResponse) {
      return errorResponse
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

    const incompleteRedirect = redirectIfSitesIncomplete({
      request,
      h,
      t,
      application,
      applicationId
    })
    if (incompleteRedirect) {
      return incompleteRedirect
    }

    const sites = selectedSites(application)

    try {
      await accreditationApiService.patchOverseasSites(
        organisationId,
        applicationId,
        { sectionStatus: 'Completed' }
      )
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { applicationId },
        `Error confirming overseas sites ${applicationId}`
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to this page
      // so it re-fetches and renders read-only.
      if (err.status === statusCodes.conflict) {
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
