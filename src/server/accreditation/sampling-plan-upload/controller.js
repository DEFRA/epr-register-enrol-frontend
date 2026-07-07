import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { apiClient } from '../../common/api-client.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { config } from '../../../config/config.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

export const SAMPLING_PLAN_UPLOAD_SESSION_KEY = 'samplingPlanUpload'

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

export function buildFilesViewModel(files) {
  return (files ?? []).map((f) => ({
    filename: f.filename ?? '',
    fileId: f.fileId ?? '',
    uploadedAt: f.uploadedAt
      ? new Date(f.uploadedAt).toLocaleDateString('en-GB')
      : '',
    uploadedBy: f.uploadedBy ?? '',
    scanStatus: f.scanStatus ?? 'Pending'
  }))
}

export function hasEligibleFile(files) {
  return (files ?? []).some((f) => (f.scanStatus ?? 'Pending') !== 'Infected')
}

function decodeField(field) {
  if (typeof field === 'string') return field
  return field?.payload?.toString()
}

function appUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}`
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/sampling-plan-upload/index', viewData)
}

export const samplingPlanUploadGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.samplingPlanUpload.title'),
        heading: t('pages.samplingPlanUpload.heading'),
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        files: [],
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    const files = buildFilesViewModel(application.samplingPlan?.files)

    return renderPage(h, {
      pageTitle: t('pages.samplingPlanUpload.title'),
      heading: t('pages.samplingPlanUpload.heading'),
      backLink: taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId),
      files
    })
  }
}

export const samplingPlanUploadPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const action = decodeField(request.payload?.action)
    const fileId = decodeField(request.payload?.fileId)

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        pageTitle: t('pages.samplingPlanUpload.title'),
        heading: t('pages.samplingPlanUpload.heading'),
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        files: [],
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    const files = buildFilesViewModel(application.samplingPlan?.files)
    const rawFiles = application.samplingPlan?.files ?? []

    function baseView(overrides = {}) {
      return {
        pageTitle: t('pages.samplingPlanUpload.title'),
        heading: t('pages.samplingPlanUpload.heading'),
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        files,
        ...overrides
      }
    }

    if (action === 'uploadFile') {
      const uploadedFile = request.payload.file
      const filename = uploadedFile?.filename ?? ''
      const contentType =
        uploadedFile?.headers?.['content-type'] ?? 'application/octet-stream'
      const fileSize = uploadedFile?.payload?.length ?? 0

      if (!filename) {
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.noFile')
          })
        ).code(400)
      }

      if (!validateFileExtension(filename)) {
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.invalidType')
          })
        ).code(400)
      }

      if (fileSize > MAX_FILE_BYTES) {
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.fileTooLarge')
          })
        ).code(400)
      }

      let uploadDetail
      try {
        uploadDetail = await initUpload({
          initiateUrl: `/api/v1/accreditation-applications/${organisationId}/${applicationId}/files/initiate`,
          redirectUrl: `${config.get('auth.callbackBaseUrl')}/accreditation/sampling-plan/${applicationId}/status`,
          s3Path: `accreditation/sampling-plan/${applicationId}`,
          s3Bucket: config.get('fileUpload.s3Bucket'),
          mimeTypes: ALLOWED_MIME_TYPES,
          maxFileSize: MAX_FILE_BYTES
        })
      } catch (err) {
        request.server.logger.error(
          `Error initiating upload for ${applicationId}: ${err.message}`
        )
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.uploadError')
          })
        ).code(500)
      }

      try {
        // cdp-uploader's /upload-and-scan responds with a redirect meant for an end-user's
        // browser to follow to the app's own "redirect" page. This is a server-to-server
        // proxy upload though, not a browser request, so that redirect must not be followed —
        // it resolves against cdp-uploader's own host, not ours, and 404s there. A redirect
        // response here means the upload itself was accepted; only a genuine non-2xx/3xx
        // response is a real failure.
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
        // Node's fetch doesn't reliably set type: 'opaqueredirect' for a redirect:'manual'
        // response in this runtime — it returns the real 3xx status directly instead — so
        // the status range must be checked too, not just the type.
        const isRedirect =
          proxyResponse.type === 'opaqueredirect' ||
          (proxyResponse.status >= 300 && proxyResponse.status < 400)
        if (!proxyResponse.ok && !isRedirect) {
          throw new Error(`CDP proxy upload failed: ${proxyResponse.status}`)
        }
      } catch (err) {
        request.server.logger.error(
          `Error proxying file for ${applicationId}: ${err.message}`
        )
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.uploadError')
          })
        ).code(500)
      }

      request.yar.set(SAMPLING_PLAN_UPLOAD_SESSION_KEY, {
        statusUrl: uploadDetail.statusUrl,
        applicationId,
        organisationId
      })

      return h.redirect(`/accreditation/sampling-plan/${applicationId}/status`)
    }

    if (action === 'deleteFile') {
      if (fileId) {
        try {
          await accreditationApiService.deleteFile(
            organisationId,
            applicationId,
            fileId
          )
        } catch (err) {
          request.server.logger.error(
            `Error deleting file ${fileId} for ${applicationId}: ${err.message}`
          )
          return renderPage(
            h,
            baseView({
              error: t('pages.samplingPlanUpload.validation.deleteError')
            })
          ).code(500)
        }
      }
      return h.redirect(`/accreditation/sampling-plan/${applicationId}`)
    }

    if (action === 'saveAndComeLater') {
      const sectionStatus = rawFiles.length > 0 ? 'InProgress' : 'NotStarted'
      try {
        await accreditationApiService.patchSamplingPlan(
          organisationId,
          applicationId,
          { sectionStatus }
        )
      } catch (err) {
        request.server.logger.error(
          `Error saving sampling plan for ${applicationId}: ${err.message}`
        )
        return renderPage(
          h,
          baseView({
            error: t('pages.samplingPlanUpload.validation.saveError')
          })
        ).code(500)
      }
      return h.redirect(taskListUrl(applicationId))
    }

    // saveAndContinue (default)
    if (!hasEligibleFile(rawFiles)) {
      return renderPage(
        h,
        baseView({
          error: t('pages.samplingPlanUpload.validation.noCleanFile')
        })
      ).code(400)
    }

    try {
      await accreditationApiService.patchSamplingPlan(
        organisationId,
        applicationId,
        { sectionStatus: 'Completed' }
      )
    } catch (err) {
      request.server.logger.error(
        `Error completing sampling plan for ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        baseView({ error: t('pages.samplingPlanUpload.validation.saveError') })
      ).code(500)
    }

    return h.redirect(taskListUrl(applicationId))
  }
}

export const samplingPlanCdpStatusController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const uploadStatus = request.pre.uploadStatus

    if (uploadStatus?.uploadStatus !== 'ready') {
      return h.view('accreditation/sampling-plan-upload/status', {
        pageTitle: t('pages.samplingPlanUpload.status.title'),
        heading: t('pages.samplingPlanUpload.status.heading'),
        processingStatus: uploadStatus?.processingStatus ?? 'preprocessing'
      })
    }

    const fileInput = uploadStatus.form?.file
    const session = request.yar.get(SAMPLING_PLAN_UPLOAD_SESSION_KEY)
    request.yar.clear(SAMPLING_PLAN_UPLOAD_SESSION_KEY)

    if (fileInput?.hasError) {
      return h.redirect(`/accreditation/sampling-plan/${applicationId}`)
    }

    const scanStatus =
      uploadStatus.processingStatus === 'validated' ? 'Clean' : 'Infected'

    try {
      await accreditationApiService.addFile(
        session?.organisationId,
        session?.applicationId ?? applicationId,
        {
          filename: fileInput?.filename,
          contentType: fileInput?.contentType ?? fileInput?.detectedContentType,
          scanStatus,
          fileId: fileInput?.fileId
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving uploaded file for ${applicationId}: ${err.message}`
      )
    }

    return h.redirect(`/accreditation/sampling-plan/${applicationId}`)
  }
}
