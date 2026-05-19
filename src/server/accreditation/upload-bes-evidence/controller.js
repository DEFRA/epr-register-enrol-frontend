import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'csv',
  'png',
  'tif',
  'jpg',
  'msg'
]

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export function validateFileExtension(filename) {
  if (!filename) return false
  const ext = filename.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext ?? '')
}

export function parseDate(day, month, year) {
  const d = parseInt(day, 10)
  const m = parseInt(month, 10)
  const y = parseInt(year, 10)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function uploadMoreUrl(applicationId, siteId) {
  return `/accreditation/upload-more-evidence/${applicationId}/${siteId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/upload-bes-evidence/index', viewData)
}

function buildViewData(t, applicationId, siteId, siteName, payload, errors) {
  return {
    pageTitle: t('pages.uploadBesEvidence.title'),
    heading: `${t('pages.uploadBesEvidence.heading')} ${siteName}`,
    backLink: `/accreditation/upload-evidence-for-overseas-site/${applicationId}`,
    taskListLink: taskListUrl(applicationId),
    siteName,
    validFromDay: payload?.validFromDay ?? '',
    validFromMonth: payload?.validFromMonth ?? '',
    validFromYear: payload?.validFromYear ?? '',
    validToDay: payload?.validToDay ?? '',
    validToMonth: payload?.validToMonth ?? '',
    validToYear: payload?.validToYear ?? '',
    ...errors
  }
}

export const uploadBesEvidenceGet413Handler = async (request, h) => {
  const { response } = request
  if (!response.isBoom || response.output.statusCode !== 413) {
    return h.continue
  }
  const { t } = getLocaleAndTranslator(request)
  const { applicationId, siteId } = request.params
  const user = getUser(request)
  const organisationId = user?.id
  const siteIdInt = parseInt(siteId, 10)

  let siteName = ''
  try {
    const application = await accreditationApiService.getApplication(
      organisationId,
      applicationId
    )
    const site = application.OverseasSites?.Sites?.find(
      (s) => s.SiteId === siteIdInt
    )
    siteName = site?.SiteName ?? ''
  } catch (_) {}

  return renderPage(
    h,
    buildViewData(
      t,
      applicationId,
      siteId,
      siteName,
      {},
      {
        fileError: t('pages.uploadBesEvidence.validation.fileTooLarge')
      }
    )
  ).code(400)
}

export const uploadBesEvidenceGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
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
          {},
          {
            error: t('pages.uploadBesEvidence.validation.fetchError')
          }
        )
      ).code(500)
    }

    const site = application.OverseasSites?.Sites?.find(
      (s) => s.SiteId === siteIdInt
    )
    const siteName = site?.SiteName ?? ''

    return renderPage(
      h,
      buildViewData(t, applicationId, siteId, siteName, {}, {})
    )
  }
}

export const uploadBesEvidencePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId, siteId } = request.params
    const siteIdInt = parseInt(siteId, 10)
    const payload = request.payload ?? {}

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
        buildViewData(t, applicationId, siteId, '', payload, {
          error: t('pages.uploadBesEvidence.validation.fetchError')
        })
      ).code(500)
    }

    const site = application.OverseasSites?.Sites?.find(
      (s) => s.SiteId === siteIdInt
    )
    const siteName = site?.SiteName ?? ''

    if (payload.action === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    // uploadFile action
    const uploadedFile = payload.file
    const filename = uploadedFile?.hapi?.filename ?? ''
    const contentType =
      uploadedFile?.hapi?.headers?.['content-type'] ??
      'application/octet-stream'
    const fileSize = uploadedFile?.length ?? 0

    if (!filename) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.noFile')
        })
      ).code(400)
    }

    if (!validateFileExtension(filename)) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.invalidType')
        })
      ).code(400)
    }

    if (fileSize > MAX_FILE_BYTES) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.fileTooLarge')
        })
      ).code(400)
    }

    const validFrom = parseDate(
      payload.validFromDay,
      payload.validFromMonth,
      payload.validFromYear
    )
    if (!validFrom) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          validFromError: t(
            'pages.uploadBesEvidence.validation.validFromRequired'
          )
        })
      ).code(400)
    }

    const validTo = parseDate(
      payload.validToDay,
      payload.validToMonth,
      payload.validToYear
    )
    if (!validTo) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          validToError: t('pages.uploadBesEvidence.validation.validToRequired')
        })
      ).code(400)
    }

    if (validTo <= validFrom) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          validToError: t(
            'pages.uploadBesEvidence.validation.validToBeforeFrom'
          )
        })
      ).code(400)
    }

    try {
      await accreditationApiService.addBesEvidenceFile(
        organisationId,
        applicationId,
        siteIdInt,
        {
          Filename: filename,
          ContentType: contentType,
          BESEvidenceValidFromDate: validFrom.toISOString(),
          BESEvidenceExpiryDate: validTo.toISOString()
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error uploading BES evidence file for site ${siteId} on ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.uploadError')
        })
      ).code(500)
    }

    return h.redirect(uploadMoreUrl(applicationId, siteId))
  }
}
