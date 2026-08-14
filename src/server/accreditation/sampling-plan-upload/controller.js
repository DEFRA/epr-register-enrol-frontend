import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { apiClient } from '../../common/api-client.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { config } from '../../../config/config.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../common/helpers/upload/proxy-upload-to-cdp.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import { resolveQueriedSectionAccess } from '../../common/helpers/queriedSectionAccess.js'

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

export const DOCUMENT_TYPES = ['SamplingPlan', 'SupportingEvidence']

const DOCUMENT_TYPE_LABEL_KEYS = {
  SamplingPlan: 'pages.samplingPlanUpload.documentType.samplingPlan',
  SupportingEvidence: 'pages.samplingPlanUpload.documentType.supportingEvidence'
}

export function documentTypeLabel(t, documentType) {
  const key = DOCUMENT_TYPE_LABEL_KEYS[documentType]
  return t(key ?? 'pages.samplingPlanUpload.documentType.notSpecified')
}

export function documentTypeOptions(t) {
  return DOCUMENT_TYPES.map((value) => ({
    value,
    label: t(DOCUMENT_TYPE_LABEL_KEYS[value])
  }))
}

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
    scanStatus: f.scanStatus ?? 'Pending',
    documentType: f.documentType ?? null
  }))
}

export function hasEligibleFile(files) {
  return (files ?? []).some((f) => (f.scanStatus ?? 'Pending') !== 'Infected')
}

function appUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}`
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function samplingPlanUrl(applicationId) {
  return `/accreditation/sampling-plan/${applicationId}`
}

function resultsUrl(applicationId) {
  return `/accreditation/sampling-plan/${applicationId}/results`
}

function renderPage(h, viewData) {
  return h.view('accreditation/sampling-plan-upload/index', viewData)
}

function renderResultsPage(h, viewData) {
  return h.view('accreditation/sampling-plan-upload/results', viewData)
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
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
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
        documentTypeOptions: documentTypeOptions(t),
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.samplingPlan?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const files = buildFilesViewModel(application.samplingPlan?.files)
    const viewableFilesCount = buildResultsFiles(
      application.samplingPlan?.files,
      t
    ).length
    const materialDisplay = t(
      `pages.materialSelection.materials.${application.materialType}`
    )
    const queryNote = resolveRegulatorQueryNote(application, { readOnly })

    return renderPage(h, {
      pageTitle: t('pages.samplingPlanUpload.title'),
      heading: `${t('pages.samplingPlanUpload.heading')} - ${materialDisplay}`,
      backLink: readOnly
        ? queryTaskListUrl(applicationId)
        : taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId),
      files,
      viewableFilesCount,
      resultsLink: resultsUrl(applicationId),
      documentTypeOptions: documentTypeOptions(t),
      queryNote,
      querySummary: queryNote
        ? buildRegulatorQuerySummary('samplingPlan', t)
        : null,
      regulatorQueryFields: queryNote
        ? [
            {
              label: t('pages.taskList.tasks.samplingPlan'),
              href: '#file'
            }
          ]
        : null,
      readOnly
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
        documentTypeOptions: documentTypeOptions(t),
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    if (
      application.applicationStatus === 'Queried' &&
      application.samplingPlan?.sectionStatus !== 'Queried'
    ) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const files = buildFilesViewModel(application.samplingPlan?.files)
    const viewableFilesCount = buildResultsFiles(
      application.samplingPlan?.files,
      t
    ).length

    function baseView(overrides = {}) {
      return {
        pageTitle: t('pages.samplingPlanUpload.title'),
        heading: t('pages.samplingPlanUpload.heading'),
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        resultsLink: resultsUrl(applicationId),
        files,
        viewableFilesCount,
        documentTypeOptions: documentTypeOptions(t),
        ...overrides
      }
    }

    const documentType = request.payload.documentType
    const uploadedFile = request.payload.file
    const filename = uploadedFile?.filename ?? ''
    const contentType =
      uploadedFile?.headers?.['content-type'] ?? 'application/octet-stream'
    const fileSize = uploadedFile?.payload?.length ?? 0

    const documentTypeError = !DOCUMENT_TYPES.includes(documentType)
      ? t('pages.samplingPlanUpload.validation.noDocumentType')
      : null

    const fileError = !filename
      ? t('pages.samplingPlanUpload.validation.noFile')
      : !validateFileExtension(filename)
        ? t('pages.samplingPlanUpload.validation.invalidType')
        : fileSize > MAX_FILE_BYTES
          ? t('pages.samplingPlanUpload.validation.fileTooLarge')
          : null

    if (documentTypeError || fileError) {
      return renderPage(
        h,
        baseView({
          documentTypeError,
          fileError,
          fields: { documentType }
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
      await proxyUploadToCdp({
        uploadUrl: uploadDetail.uploadUrl,
        payload: uploadedFile.payload,
        filename,
        contentType
      })
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
      organisationId,
      documentType
    })

    return h.redirect(`/accreditation/sampling-plan/${applicationId}/status`)
  }
}

function buildResultsFiles(files, t) {
  return buildFilesViewModel(files)
    .filter((f) => f.scanStatus !== 'Infected')
    .map((f) => ({
      ...f,
      documentTypeLabel: documentTypeLabel(t, f.documentType)
    }))
}

export const samplingPlanResultsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const uploadFailed = request.query?.upload === 'failed'

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
      return renderResultsPage(h, {
        pageTitle: t('pages.samplingPlanUpload.resultsTitle'),
        heading: t('pages.samplingPlanUpload.uploadedFilesHeading'),
        backLink: samplingPlanUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        uploadAnotherLink: samplingPlanUrl(applicationId),
        files: [],
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.samplingPlan?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const rawFiles = application.samplingPlan?.files ?? []
    const files = buildResultsFiles(rawFiles, t)

    if (files.length === 0 && !uploadFailed) {
      return h.redirect(samplingPlanUrl(applicationId))
    }

    return renderResultsPage(h, {
      pageTitle: t('pages.samplingPlanUpload.resultsTitle'),
      heading: t('pages.samplingPlanUpload.uploadedFilesHeading'),
      backLink: samplingPlanUrl(applicationId),
      taskListLink: taskListUrl(applicationId),
      uploadAnotherLink: samplingPlanUrl(applicationId),
      files,
      error: uploadFailed
        ? t('pages.samplingPlanUpload.validation.uploadError')
        : null,
      readOnly
    })
  }
}

export const samplingPlanResultsPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { action = 'saveAndContinue', fileId } = request.payload ?? {}

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
      return renderResultsPage(h, {
        pageTitle: t('pages.samplingPlanUpload.resultsTitle'),
        heading: t('pages.samplingPlanUpload.uploadedFilesHeading'),
        backLink: samplingPlanUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        uploadAnotherLink: samplingPlanUrl(applicationId),
        files: [],
        error: t('pages.samplingPlanUpload.validation.fetchError')
      }).code(500)
    }

    if (
      application.applicationStatus === 'Queried' &&
      application.samplingPlan?.sectionStatus !== 'Queried'
    ) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const rawFiles = application.samplingPlan?.files ?? []
    const files = buildResultsFiles(rawFiles, t)

    function baseView(overrides = {}) {
      return {
        pageTitle: t('pages.samplingPlanUpload.resultsTitle'),
        heading: t('pages.samplingPlanUpload.uploadedFilesHeading'),
        backLink: samplingPlanUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        uploadAnotherLink: samplingPlanUrl(applicationId),
        files,
        ...overrides
      }
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
          return renderResultsPage(
            h,
            baseView({
              error: t('pages.samplingPlanUpload.validation.deleteError')
            })
          ).code(500)
        }
      }
      return h.redirect(resultsUrl(applicationId))
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
        return renderResultsPage(
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
      return renderResultsPage(
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
      return renderResultsPage(
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
      return h.redirect(`${resultsUrl(applicationId)}?upload=failed`)
    }

    // CDP uploader's form.file.fileStatus is now the authoritative virus-scan
    // outcome ('complete' = passed). hasError above already covers rejected
    // uploads, so any other fileStatus here is treated as Infected (fail-closed).
    const scanStatus =
      fileInput?.fileStatus === 'complete' ? 'Clean' : 'Infected'

    try {
      await accreditationApiService.addFile(
        session?.organisationId,
        session?.applicationId ?? applicationId,
        {
          filename: fileInput?.filename,
          contentType: fileInput?.contentType ?? fileInput?.detectedContentType,
          scanStatus,
          fileId: fileInput?.fileId,
          s3Key: fileInput?.s3Key,
          s3Bucket: fileInput?.s3Bucket,
          documentType: session?.documentType
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving uploaded file for ${applicationId}: ${err.message}`
      )
      return h.redirect(`${resultsUrl(applicationId)}?upload=failed`)
    }

    return h.redirect(
      scanStatus === 'Infected'
        ? `${resultsUrl(applicationId)}?upload=failed`
        : resultsUrl(applicationId)
    )
  }
}
