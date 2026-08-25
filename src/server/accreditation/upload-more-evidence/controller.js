import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'

function uploadBesEvidenceUrl(applicationId, siteId) {
  return `/accreditation/upload-bes-evidence/${applicationId}/${siteId}`
}

function cyaUrl(applicationId, siteId) {
  return `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/upload-more-evidence/index', viewData)
}

function buildViewData(
  t,
  applicationId,
  siteId,
  siteName,
  answer,
  error,
  readOnly = false,
  isQueriedApplication = false
) {
  return {
    pageTitle: t('pages.uploadMoreEvidence.title'),
    heading: `${t('pages.uploadMoreEvidence.heading')} ${siteName}?`,
    backLink: uploadBesEvidenceUrl(applicationId, siteId),
    siteName,
    answer,
    error,
    readOnly,
    isQueriedApplication
  }
}

export const uploadMoreEvidenceGetController = {
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
          null,
          t('pages.uploadMoreEvidence.loadError')
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

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        siteId,
        siteName,
        null,
        null,
        readOnly,
        application.applicationStatus === 'Queried'
      )
    )
  }
}

export const uploadMoreEvidencePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId } = request.params
    const siteIdInt = Number.parseInt(siteId, 10)
    const { answer } = request.payload ?? {}

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
          answer,
          t('pages.uploadMoreEvidence.loadError')
        )
      ).code(500)
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

    if (!answer) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          siteId,
          siteName,
          null,
          t('pages.uploadMoreEvidence.validation.required')
        )
      ).code(400)
    }

    if (answer === 'yes') {
      return h.redirect(uploadBesEvidenceUrl(applicationId, siteId))
    }

    try {
      await accreditationApiService.patchBesEvidence(
        organisationId,
        applicationId,
        siteIdInt,
        { doYouWantToUploadMoreEvidence: false }
      )
    } catch (err) {
      request.server.logger.error(
        `Error patching BES evidence for site ${siteId} on ${applicationId}: ${err.message}`
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
          siteId,
          siteName,
          answer,
          t('pages.uploadMoreEvidence.saveError')
        )
      ).code(500)
    }

    return h.redirect(cyaUrl(applicationId, siteId))
  }
}
