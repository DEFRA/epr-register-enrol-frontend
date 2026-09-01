import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import { resolveQueriedSectionAccess } from '../../common/helpers/queriedSectionAccess.js'
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

function mapUploads(uploads) {
  return (uploads ?? []).map((u) => ({
    fileId: u.fileId ?? '',
    filename: u.filename ?? '',
    startDate: formatDate(u.besEvidenceValidFromDate),
    endDate: formatDate(u.besEvidenceExpiryDate)
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
    const uploads = mapUploads(site?.besEvidence?.besEvidenceUploads)

    return renderPage(
      h,
      buildViewData(t, applicationId, siteId, siteName, uploads, null, {
        readOnly,
        isQueriedApplication: application.applicationStatus === 'Queried'
      })
    )
  }
}

export const cyaEvidenceForSitePostController = {
  async handler(request, h) {
    const { applicationId } = request.params
    return h.redirect(evidenceListUrl(applicationId))
  }
}
