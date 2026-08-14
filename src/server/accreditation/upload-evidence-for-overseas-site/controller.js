import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import { resolveQueriedSectionAccess } from '../../common/helpers/queriedSectionAccess.js'

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
  readOnly = false
) {
  return {
    pageTitle: t('pages.uploadEvidenceList.title'),
    heading: t('pages.uploadEvidenceList.heading'),
    sites,
    backLink: readOnly
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    error,
    queryNote,
    querySummary,
    regulatorQueryFields,
    readOnly
  }
}

export const uploadEvidenceListGetController = {
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
          t('pages.uploadEvidenceList.loadError')
        )
      ).code(500)
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
        readOnly
      )
    )
  }
}

export const uploadEvidenceListPostController = {
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
          t('pages.uploadEvidenceList.loadError')
        )
      ).code(500)
    }

    if (
      application.applicationStatus === 'Queried' &&
      application.besEvidence?.sectionStatus !== 'Queried'
    ) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const selectedSites = (application.overseasSites?.sites ?? []).filter(
      (s) => s.selected !== false
    )
    const sites = mapSites(t, applicationId, selectedSites)

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

    return h.redirect(taskListUrl(applicationId))
  }
}
