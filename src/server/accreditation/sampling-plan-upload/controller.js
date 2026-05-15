import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { apiClient } from '../../common/api-client.js'
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

export function buildFilesViewModel(files) {
  return (files ?? []).map((f) => ({
    filename: f.Filename ?? '',
    fileId: f.FileId ?? '',
    uploadedAt: f.UploadedAt
      ? new Date(f.UploadedAt).toLocaleDateString('en-GB')
      : '',
    uploadedBy: f.UploadedBy ?? '',
    scanStatus: f.ScanStatus ?? 'Pending'
  }))
}

export function hasEligibleFile(files) {
  return (files ?? []).some((f) => (f.ScanStatus ?? 'Pending') !== 'Infected')
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

export async function samplingPlanUpload413Handler(request, h) {
  const { response } = request
  if (!response.isBoom || response.output.statusCode !== 413) {
    return h.continue
  }

  const { t } = getLocaleAndTranslator(request)
  const user = getUser(request)
  const organisationId = user?.id
  const { applicationId } = request.params

  let files = []
  try {
    const application = await apiClient.get(
      appUrl(organisationId, applicationId)
    )
    files = buildFilesViewModel(application.SamplingPlan?.Files)
  } catch (_) {
    // render with empty file list if fetch fails
  }

  return renderPage(h, {
    pageTitle: t('pages.samplingPlanUpload.title'),
    heading: t('pages.samplingPlanUpload.heading'),
    backLink: taskListUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    files,
    fileError: t('pages.samplingPlanUpload.validation.fileTooLarge')
  }).code(400)
}

export const samplingPlanUploadGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
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

    const files = buildFilesViewModel(application.SamplingPlan?.Files)

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
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params
    const { action, fileId } = request.payload ?? {}

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

    const files = buildFilesViewModel(application.SamplingPlan?.Files)
    const rawFiles = application.SamplingPlan?.Files ?? []

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
      const filename = uploadedFile?.hapi?.filename ?? ''
      const contentType =
        uploadedFile?.hapi?.headers?.['content-type'] ??
        'application/octet-stream'
      const fileSize = uploadedFile?.length ?? 0

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

      try {
        await accreditationApiService.addFile(organisationId, applicationId, {
          Filename: filename,
          ContentType: contentType
        })
      } catch (err) {
        request.server.logger.error(
          `Error uploading file for ${applicationId}: ${err.message}`
        )
        return renderPage(
          h,
          baseView({
            fileError: t('pages.samplingPlanUpload.validation.uploadError')
          })
        ).code(500)
      }

      return h.redirect(`/accreditation/sampling-plan/${applicationId}`)
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
          { SectionStatus: sectionStatus }
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
        { SectionStatus: 'Completed' }
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
