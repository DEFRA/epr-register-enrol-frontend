import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { config } from '../../../config/config.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../common/helpers/upload/proxy-upload-to-cdp.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

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
  if (!filename) {
    return false
  }
  const ext = filename.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext ?? '')
}

export function parseDate(day, month, year) {
  const d = Number.parseInt(day, 10)
  const m = Number.parseInt(month, 10)
  const y = Number.parseInt(year, 10)
  if (Number.isNaN(d) || Number.isNaN(m) || Number.isNaN(y)) {
    return null
  }
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null
  }
  return date
}

export function isDateBlank(day, month, year) {
  return (
    !(day ?? '').toString().trim() &&
    !(month ?? '').toString().trim() &&
    !(year ?? '').toString().trim()
  )
}

// Extracted from uploadBesEvidencePostController (SonarCloud cognitive
// complexity): the optional "valid to" date was parsed and validated in a
// block nested inside an `if (!validToBlank)`, which is exactly the kind of
// nesting cognitive complexity penalises hardest. Flattened into its own
// function so the handler gets back a plain { validTo, error } result.
function resolveBesEvidenceValidTo(payload, validFrom, t) {
  const validToBlank = isDateBlank(
    payload.validToDay,
    payload.validToMonth,
    payload.validToYear
  )
  if (validToBlank) {
    return { validTo: null, error: null }
  }

  const validTo = parseDate(
    payload.validToDay,
    payload.validToMonth,
    payload.validToYear
  )
  if (!validTo) {
    return {
      validTo: null,
      error: t('pages.uploadBesEvidence.validation.invalidDate')
    }
  }
  if (validTo <= validFrom) {
    return {
      validTo: null,
      error: t('pages.uploadBesEvidence.validation.validToBeforeFrom')
    }
  }

  return { validTo, error: null }
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function uploadMoreUrl(applicationId, siteId) {
  return `/accreditation/upload-more-evidence/${applicationId}/${siteId}`
}

function cyaEvidenceUrl(applicationId, siteId) {
  return `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/upload-bes-evidence/index', viewData)
}

function renderAmendPage(h, viewData) {
  return h.view('accreditation/upload-bes-evidence/amend', viewData)
}

// RA-570: splits an ISO date string back into the day/month/year fields the
// amend form (and parseDate/isDateBlank above) expect, so an existing file's
// dates can be pre-filled for editing.
function isoToDateParts(isoString) {
  if (!isoString) {
    return { day: '', month: '', year: '' }
  }
  const date = new Date(isoString)
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear())
  }
}

function findBesEvidenceFile(application, siteIdInt, fileId) {
  const site = application.overseasSites?.sites?.find(
    (s) => s.siteId === siteIdInt
  )
  const upload = site?.besEvidence?.besEvidenceUploads?.find(
    (u) => u.fileId === fileId
  )
  return { site, upload }
}

function buildViewData(
  t,
  applicationId,
  siteName,
  payload,
  errors,
  { readOnly = false, isQueriedApplication = false } = {}
) {
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
    readOnly,
    isQueriedApplication,
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
            '',
            {},
            {
              error: t('pages.uploadBesEvidence.validation.fetchError')
            }
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

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        siteName,
        {},
        {},
        {
          readOnly,
          isQueriedApplication: application.applicationStatus === 'Queried'
        }
      )
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
    const siteIdInt = Number.parseInt(siteId, 10)
    const payload = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(
          h,
          buildViewData(t, applicationId, '', payload, {
            error: t('pages.uploadBesEvidence.validation.fetchError')
          })
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
        buildViewData(t, applicationId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.noFile')
        })
      ).code(400)
    }

    if (!validateFileExtension(filename)) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.invalidType')
        })
      ).code(400)
    }

    if (fileSize > MAX_FILE_BYTES) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, payload, {
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
        buildViewData(t, applicationId, siteName, payload, {
          validFromError: t(
            'pages.uploadBesEvidence.validation.validFromRequired'
          )
        })
      ).code(400)
    }

    const { validTo, error: validToError } = resolveBesEvidenceValidTo(
      payload,
      validFrom,
      t
    )
    if (validToError) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, payload, {
          validToError
        })
      ).code(400)
    }

    const besEvidenceValidFromDate = validFrom.toISOString()
    const besEvidenceExpiryDate = validTo ? validTo.toISOString() : null

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
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId },
        `Error initiating BES evidence upload for site ${siteId}, application ${applicationId}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.uploadError')
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
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId },
        `Error proxying BES evidence file for site ${siteId}, application ${applicationId}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, payload, {
          fileError: t('pages.uploadBesEvidence.validation.uploadError')
        })
      ).code(500)
    }

    request.yar.set(BES_EVIDENCE_UPLOAD_SESSION_KEY, {
      statusUrl: uploadDetail.statusUrl,
      fileUploadId: uploadDetail.fileUploadId,
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

    try {
      await accreditationApiService.addBesEvidenceFile(
        session?.organisationId,
        session?.applicationId ?? applicationId,
        session?.siteId ?? Number.parseInt(siteId, 10),
        {
          fileUploadId: session?.fileUploadId,
          besEvidenceValidFromDate: session?.besEvidenceValidFromDate,
          besEvidenceExpiryDate: session?.besEvidenceExpiryDate
        }
      )
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId },
        `Error saving BES evidence file for site ${siteId}, application ${applicationId}`
      )
    }

    return h.redirect(uploadMoreUrl(applicationId, siteId))
  }
}

// RA-570: amend the dates on an already-uploaded BES evidence file. Deletion
// stays a separate action on the review screen (cya-evidence-for-overseas-
// site) — this route only ever changes dates, reusing the same
// parseDate/resolveBesEvidenceValidTo validation as a fresh upload.
function buildAmendViewData(
  t,
  applicationId,
  siteId,
  siteName,
  fileId,
  filename,
  payload,
  errors
) {
  return {
    pageTitle: t('pages.uploadBesEvidence.amend.title'),
    heading: `${t('pages.uploadBesEvidence.amend.heading')} ${siteName}`,
    backLink: cyaEvidenceUrl(applicationId, siteId),
    taskListLink: taskListUrl(applicationId),
    cancelLink: cyaEvidenceUrl(applicationId, siteId),
    siteName,
    fileId,
    filename,
    validFromDay: payload?.validFromDay ?? '',
    validFromMonth: payload?.validFromMonth ?? '',
    validFromYear: payload?.validFromYear ?? '',
    validToDay: payload?.validToDay ?? '',
    validToMonth: payload?.validToMonth ?? '',
    validToYear: payload?.validToYear ?? '',
    ...errors
  }
}

// Maps an existing upload's ISO dates to the day/month/year payload shape
// buildAmendViewData/parseDate expect, so the GET and POST handlers below
// pre-fill and re-render the form the same way.
function amendFormPayloadFromUpload(upload) {
  const from = isoToDateParts(upload.besEvidenceValidFromDate)
  const to = isoToDateParts(upload.besEvidenceExpiryDate)
  return {
    validFromDay: from.day,
    validFromMonth: from.month,
    validFromYear: from.year,
    validToDay: to.day,
    validToMonth: to.month,
    validToYear: to.year
  }
}

export const besEvidenceAmendGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId, fileId } = request.params
    const siteIdInt = parseInt(siteId, 10)

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderAmendPage(
          h,
          buildAmendViewData(
            t,
            applicationId,
            siteId,
            '',
            fileId,
            '',
            {},
            {
              error: t('pages.uploadBesEvidence.validation.fetchError')
            }
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
    if (blocked || readOnly) {
      return h.redirect(
        blocked
          ? queryTaskListUrl(applicationId)
          : cyaEvidenceUrl(applicationId, siteId)
      )
    }

    const { site, upload } = findBesEvidenceFile(application, siteIdInt, fileId)
    if (!upload) {
      return h.redirect(cyaEvidenceUrl(applicationId, siteId))
    }
    const siteName = site?.siteName ?? ''

    return renderAmendPage(
      h,
      buildAmendViewData(
        t,
        applicationId,
        siteId,
        siteName,
        fileId,
        upload.filename ?? '',
        amendFormPayloadFromUpload(upload),
        {}
      )
    )
  }
}

export const besEvidenceAmendPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId, fileId } = request.params
    const siteIdInt = Number.parseInt(siteId, 10)
    const payload = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderAmendPage(
          h,
          buildAmendViewData(
            t,
            applicationId,
            siteId,
            '',
            fileId,
            '',
            payload,
            {
              error: t('pages.uploadBesEvidence.validation.fetchError')
            }
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

    const { site, upload } = findBesEvidenceFile(application, siteIdInt, fileId)
    if (!upload) {
      return h.redirect(cyaEvidenceUrl(applicationId, siteId))
    }
    const siteName = site?.siteName ?? ''

    const validFrom = parseDate(
      payload.validFromDay,
      payload.validFromMonth,
      payload.validFromYear
    )
    if (!validFrom) {
      return renderAmendPage(
        h,
        buildAmendViewData(
          t,
          applicationId,
          siteId,
          siteName,
          fileId,
          upload.filename ?? '',
          payload,
          {
            validFromError: t(
              'pages.uploadBesEvidence.validation.validFromRequired'
            )
          }
        )
      ).code(400)
    }

    const { validTo, error: validToError } = resolveBesEvidenceValidTo(
      payload,
      validFrom,
      t
    )
    if (validToError) {
      return renderAmendPage(
        h,
        buildAmendViewData(
          t,
          applicationId,
          siteId,
          siteName,
          fileId,
          upload.filename ?? '',
          payload,
          { validToError }
        )
      ).code(400)
    }

    try {
      await accreditationApiService.updateBesEvidenceFile(
        organisationId,
        applicationId,
        siteIdInt,
        fileId,
        {
          besEvidenceValidFromDate: validFrom.toISOString(),
          besEvidenceExpiryDate: validTo ? validTo.toISOString() : null
        }
      )
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId, fileId },
        `Error amending BES evidence file ${fileId} for site ${siteId}, application ${applicationId}`
      )
      if (err.status === statusCodes.conflict) {
        return h.redirect(request.path)
      }
      return renderAmendPage(
        h,
        buildAmendViewData(
          t,
          applicationId,
          siteId,
          siteName,
          fileId,
          upload.filename ?? '',
          payload,
          { error: t('pages.uploadBesEvidence.validation.amendError') }
        )
      ).code(500)
    }

    return h.redirect(cyaEvidenceUrl(applicationId, siteId))
  }
}
