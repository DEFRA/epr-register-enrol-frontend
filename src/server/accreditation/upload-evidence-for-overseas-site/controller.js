import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

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

export function besEvidenceRequired(site) {
  return !site.isEu && !site.isOecd && !site.conditionsOfExport
}

export function evidenceStatus(site, t) {
  if (site.isEu) {
    return {
      text: t('pages.uploadEvidenceList.notRequiredEu'),
      tagClass: 'govuk-tag--blue'
    }
  }
  if (site.isOecd) {
    return {
      text: t('pages.uploadEvidenceList.notRequiredOecd'),
      tagClass: 'govuk-tag--blue'
    }
  }
  if ((site.besEvidence?.besEvidenceUploads?.length ?? 0) > 0) {
    return {
      text: t('pages.uploadEvidenceList.evidenceUploaded'),
      tagClass: 'govuk-tag--green'
    }
  }
  return {
    text: t('pages.uploadEvidenceList.evidenceNotUploaded'),
    tagClass: 'govuk-tag--grey'
  }
}

function mapSites(t, applicationId, rawSites) {
  return (rawSites ?? []).map((s) => {
    const required = besEvidenceRequired(s)
    const status = evidenceStatus(s, t)
    return {
      siteId: s.siteId,
      siteName: s.siteName ?? '',
      country: s.country ?? '',
      evidenceRequired: required,
      evidenceStatusText: status.text,
      evidenceStatusClass: status.tagClass,
      uploadUrl: uploadUrl(applicationId, s.siteId)
    }
  })
}

function buildViewData(
  t,
  applicationId,
  sites,
  error,
  queryNote = null,
  querySummary = null,
  regulatorQueryFields = null,
  readOnly = false,
  isQueriedApplication = false
) {
  return {
    pageTitle: t('pages.uploadEvidenceList.title'),
    heading: t('pages.uploadEvidenceList.heading'),
    sites,
    // RA-481: only route back to the query task list while the application
    // itself is mid-query — a locked-but-not-queried application is
    // read-only for a different reason and belongs back on the ordinary
    // task list, which renders read-only in that case too.
    backLink: isQueriedApplication
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    error,
    queryNote,
    querySummary,
    regulatorQueryFields,
    readOnly,
    isQueriedApplication
  }
}

// Shared by both controllers below (SonarCloud duplication): the fetch-failure page is
// identical whether the request was a GET or a POST.
function renderFetchErrorPage(h, t, applicationId) {
  return renderPage(
    h,
    buildViewData(t, applicationId, [], t('pages.uploadEvidenceList.loadError'))
  ).code(500)
}

export const uploadEvidenceListGetController = {
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
      application.besEvidence?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const selectedSites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )
    const sites = mapSites(t, applicationId, selectedSites)
    const queryNote = resolveRegulatorQueryNote(application, { readOnly })
    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        sites,
        null,
        queryNote,
        queryNote ? buildRegulatorQuerySummary('besEvidence', t) : null,
        queryNote
          ? [
              {
                label: t('pages.taskList.tasks.besEvidence'),
                href: '#sites-table'
              }
            ]
          : null,
        readOnly,
        application.applicationStatus === 'Queried'
      )
    )
  }
}

// Extracted from uploadEvidenceListPostController's handler (SonarCloud cyclomatic
// complexity): the patch-failure branching (409 lock race, transient 5xx, or a
// re-rendered validation-style 4xx) doesn't need to live inline in the handler.
function handleSectionPatchError(h, t, err, { applicationId, sites, request }) {
  logStructuredError(
    request.server.logger,
    err,
    { applicationId },
    `Error completing BES evidence section ${applicationId}`
  )
  // RA-481: a 409 means the application locked between the guard check
  // above and this write landing — send the operator back to the
  // section's own page so it re-fetches and renders read-only.
  if (err.status === statusCodes.conflict) {
    return h.redirect(request.path)
  }
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
      sites,
      t('pages.uploadEvidenceList.saveError')
    )
  ).code(400)
}

export const uploadEvidenceListPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction = 'saveAndContinue' } = request.payload ?? {}
    const isSaveAndComeLater = submitAction === 'saveAndComeLater'

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
      sectionStatus: application.besEvidence?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const selectedSites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )
    const sites = mapSites(t, applicationId, selectedSites)

    if (!isSaveAndComeLater) {
      const incomplete = selectedSites.some(
        (s) =>
          besEvidenceRequired(s) &&
          (s.besEvidence?.besEvidenceUploads?.length ?? 0) === 0
      )
      if (incomplete) {
        return renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            sites,
            t('pages.uploadEvidenceList.incompleteEvidence')
          )
        ).code(400)
      }
    }

    try {
      await accreditationApiService.patchBesEvidenceSection(
        organisationId,
        applicationId,
        { sectionStatus: isSaveAndComeLater ? 'InProgress' : 'Completed' }
      )
    } catch (err) {
      return handleSectionPatchError(h, t, err, {
        applicationId,
        sites,
        request
      })
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
