import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

function evidenceListUrl(applicationId) {
  return `/accreditation/upload-evidence-for-overseas-site/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/cya-evidence-for-overseas-site/index', viewData)
}

function formatDate(isoString) {
  if (!isoString) {
    return ''
  }
  return new Date(isoString).toLocaleDateString('en-GB')
}

// RA-570: amendLink points at upload-bes-evidence's amend route, which
// reuses that controller's existing date validation for editing a single
// file's dates.
function amendUrl(applicationId, siteId, fileId) {
  return `/accreditation/upload-bes-evidence/${applicationId}/${siteId}/amend/${fileId}`
}

function mapUploads(uploads, applicationId, siteId) {
  return (uploads ?? []).map((u) => ({
    fileId: u.fileId ?? '',
    filename: u.filename ?? '',
    startDate: formatDate(u.besEvidenceValidFromDate),
    endDate: formatDate(u.besEvidenceExpiryDate),
    amendLink: amendUrl(applicationId, siteId, u.fileId ?? '')
  }))
}

function buildViewData(
  t,
  applicationId,
  siteId,
  siteName,
  uploads,
  error,
  { readOnly = false, isQueriedApplication = false } = {}
) {
  return {
    pageTitle: t('pages.cyaEvidenceForSite.title'),
    heading: `${t('pages.cyaEvidenceForSite.heading')} ${siteName}`,
    backLink: `/accreditation/upload-more-evidence/${applicationId}/${siteId}`,
    uploads,
    siteName,
    error,
    readOnly,
    isQueriedApplication
  }
}

export const cyaEvidenceForSiteGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId } = request.params
    const siteIdInt = parseInt(siteId, 10)

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            siteId,
            '',
            [],
            t('pages.cyaEvidenceForSite.loadError')
          )
        ).code(500)
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

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''
    const uploads = mapUploads(
      site?.besEvidence?.besEvidenceUploads,
      applicationId,
      siteId
    )

    return renderPage(
      h,
      buildViewData(t, applicationId, siteId, siteName, uploads, null, {
        readOnly,
        isQueriedApplication: application.applicationStatus === 'Queried'
      })
    )
  }
}

// RA-570: deleting a BES evidence file is only safe while at least one other
// file remains for the site — a site can never be left with zero evidence
// files. Mirrors the "must have at least one file" style of validation used
// elsewhere (e.g. sampling-plan-upload's noCleanFile check), just applied
// before the delete happens rather than before "complete".
async function deleteEvidenceFile({
  h,
  request,
  t,
  organisationId,
  applicationId,
  siteId,
  siteName,
  uploads,
  fileId
}) {
  const fileExists = uploads.some((u) => u.fileId === fileId)
  if (!fileExists || uploads.length <= 1) {
    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        siteId,
        siteName,
        uploads,
        t('pages.cyaEvidenceForSite.validation.cannotDeleteLastFile')
      )
    ).code(400)
  }

  try {
    await accreditationApiService.deleteFile(
      organisationId,
      applicationId,
      fileId
    )
  } catch (err) {
    logStructuredError(
      request.server.logger,
      err,
      { fileId, applicationId },
      `Error deleting BES evidence file ${fileId} for application ${applicationId}`
    )
    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        siteId,
        siteName,
        uploads,
        t('pages.cyaEvidenceForSite.validation.deleteError')
      )
    ).code(500)
  }

  return h.redirect(request.path)
}

export const cyaEvidenceForSitePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId } = request.params
    const siteIdInt = Number.parseInt(siteId, 10)
    const { action = 'confirm', fileId } = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            siteId,
            '',
            [],
            t('pages.cyaEvidenceForSite.loadError')
          )
        ).code(500)
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

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''
    const uploads = mapUploads(
      site?.besEvidence?.besEvidenceUploads,
      applicationId,
      siteId
    )

    if (action === 'deleteFile') {
      return deleteEvidenceFile({
        h,
        request,
        t,
        organisationId,
        applicationId,
        siteId,
        siteName,
        uploads,
        fileId
      })
    }

    return h.redirect(evidenceListUrl(applicationId))
  }
}
