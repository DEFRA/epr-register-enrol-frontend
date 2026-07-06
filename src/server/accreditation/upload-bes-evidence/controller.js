import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { config } from '../../../config/config.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

export const BES_EVIDENCE_UPLOAD_SESSION_KEY = 'besEvidenceUpload'

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

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'text/csv',
  'image/png',
  'image/tiff',
  'image/jpeg',
  'application/vnd.ms-outlook'
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

export const uploadBesEvidenceGetController = {
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
          {},
          {
            error: t('pages.uploadBesEvidence.validation.fetchError')
          }
        )
      ).code(500)
    }

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''

    return renderPage(
      h,
      buildViewData(t, applicationId, siteId, siteName, {}, {})
    )
  }
}

export const uploadBesEvidencePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
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

    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    const siteName = site?.siteName ?? ''

    if (payload.action === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    // uploadFile action
    const uploadedFile = payload.file
    const filename = uploadedFile?.filename ?? ''
    const contentType =
      uploadedFile?.headers?.['content-type'] ?? 'application/octet-stream'
    const fileSize = uploadedFile?.payload?.length ?? 0

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

    const besEvidenceValidFromDate = validFrom.toISOString()
    const besEvidenceExpiryDate = validTo.toISOString()

    let uploadDetail
    try {
      uploadDetail = await initUpload({
        initiateUrl: `/api/v1/accreditation-applications/${organisationId}/${applicationId}/files/bes-evidence/initiate`,
        redirectUrl: `${config.get('auth.callbackBaseUrl')}/accreditation/upload-bes-evidence/${applicationId}/${siteId}/status`,
        s3Path: `accreditation/bes-evidence/${applicationId}/${siteId}`,
        s3Bucket: config.get('fileUpload.s3Bucket'),
        metadata: { besEvidenceValidFromDate, besEvidenceExpiryDate },
        mimeTypes: ALLOWED_MIME_TYPES,
        maxFileSize: MAX_FILE_BYTES
      })
    } catch (err) {
      request.server.logger.error(
        `Error initiating BES evidence upload for site ${siteId} on ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.uploadError')
        })
      ).code(500)
    }

    try {
      const proxyResponse = await fetch(uploadDetail.uploadUrl, {
        method: 'POST',
        body: uploadedFile.payload,
        duplex: 'half',
        redirect: 'manual',
        headers: {
          'x-filename': filename,
          'Content-Type': contentType
        }
      })
      if (!proxyResponse.ok && proxyResponse.type !== 'opaqueredirect') {
        throw new Error(`CDP proxy upload failed: ${proxyResponse.status}`)
      }
    } catch (err) {
      request.server.logger.error(
        `Error proxying BES evidence file for site ${siteId} on ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, siteId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.uploadError')
        })
      ).code(500)
    }

    request.yar.set(BES_EVIDENCE_UPLOAD_SESSION_KEY, {
      statusUrl: uploadDetail.statusUrl,
      applicationId,
      siteId: siteIdInt,
      organisationId,
      besEvidenceValidFromDate,
      besEvidenceExpiryDate
    })

    return h.redirect(
      `/accreditation/upload-bes-evidence/${applicationId}/${siteId}/status`
    )
  }
}

export const besEvidenceCdpStatusController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const uploadStatus = request.pre.uploadStatus

    if (uploadStatus?.uploadStatus !== 'ready') {
      return h.view('accreditation/upload-bes-evidence/status', {
        pageTitle: t('pages.uploadBesEvidence.status.title'),
        heading: t('pages.uploadBesEvidence.status.heading'),
        processingStatus: uploadStatus?.processingStatus ?? 'preprocessing'
      })
    }

    const fileInput = uploadStatus.form?.file
    const session = request.yar.get(BES_EVIDENCE_UPLOAD_SESSION_KEY)
    request.yar.clear(BES_EVIDENCE_UPLOAD_SESSION_KEY)

    if (fileInput?.hasError) {
      return h.redirect(
        `/accreditation/upload-bes-evidence/${applicationId}/${siteId}`
      )
    }

    const scanStatus =
      uploadStatus.processingStatus === 'validated' ? 'Clean' : 'Infected'

    try {
      await accreditationApiService.addBesEvidenceFile(
        session?.organisationId,
        session?.applicationId ?? applicationId,
        session?.siteId ?? parseInt(siteId, 10),
        {
          filename: fileInput?.filename,
          contentType: fileInput?.contentType ?? fileInput?.detectedContentType,
          scanStatus,
          fileId: fileInput?.fileId,
          besEvidenceValidFromDate: session?.besEvidenceValidFromDate,
          besEvidenceExpiryDate: session?.besEvidenceExpiryDate
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving BES evidence file for site ${siteId} on ${applicationId}: ${err.message}`
      )
    }

    return h.redirect(uploadMoreUrl(applicationId, siteId))
  }
}
