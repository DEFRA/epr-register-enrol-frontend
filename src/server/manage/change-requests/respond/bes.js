import { config } from '../../../../config/config.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { accreditationChangesService } from '../../../common/helpers/accreditationChangesService.js'
import { isFilenameAmong } from '../../../common/helpers/duplicateFilename.js'
import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { localePrefix } from '../../../common/helpers/localePrefix.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'
import { initUpload } from '../../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../../common/helpers/upload/proxy-upload-to-cdp.js'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  hasMaxBesEvidenceFiles,
  parseDate,
  resolveBesEvidenceValidTo,
  uploadRejectionErrorFromQuery,
  uploadRejectionQuery,
  validateFileExtension
} from '../../../accreditation/upload-bes-evidence/controller.js'
import { FLASH_UPDATED } from './steps.js'
import { loadQueriedItem } from './load.js'
import { respondUrl } from './urls.js'

// RA-698: the queried item's BES evidence. Files it held when the query was
// raised are shown but cannot be removed; only files added in response can.

export const RESPOND_BES_UPLOAD_SESSION_KEY = 'respondBesEvidenceUpload'

// A failed upload or save that has no more specific reason.
const UPLOAD_FAILED_QUERY = 'reason=uploadFailed'

const VIEW = 'manage/change-requests/respond/bes'

const filesOf = (holder) => holder?.besEvidence?.besEvidenceUploads ?? []

function splitFiles(ctx) {
  const before = new Set(ctx.item.query.preQueryBesFileIds ?? [])
  const files = filesOf(ctx.item)
  return {
    existing: files.filter((file) => before.has(file.fileId)),
    added: files.filter((file) => !before.has(file.fileId))
  }
}

// The ORS's own files count towards the cap and the unique names too.
function allFiles(ctx) {
  const held = filesOf(ctx.entry?.site)
  const ids = new Set(held.map((file) => file.fileId))
  return [...held, ...filesOf(ctx.item).filter((f) => !ids.has(f.fileId))]
}

function filenamesInUse(ctx) {
  return [
    ...(ctx.view.sites ?? []).flatMap((entry) => filesOf(entry.site)),
    ...(ctx.view.requests ?? []).flatMap((request) =>
      (request.sites ?? []).flatMap(filesOf)
    )
  ].map((file) => file?.filename)
}

function renderPage(h, ctx, payload = {}, errors = {}) {
  const { existing, added } = splitFiles(ctx)
  const text = (key) => ctx.t(`pages.manageChangeRequests.respond.${key}`)
  return h.view(VIEW, {
    pageTitle: ctx.t('pages.uploadBesEvidence.title'),
    heading: `${ctx.t('pages.uploadBesEvidence.heading')} ${ctx.item.siteName}`,
    backLink: ctx.itemUrl,
    cancelUrl: ctx.itemUrl,
    cancelLink: text('actions.cancel'),
    continueLabel: text('actions.continue'),
    existingHeading: text('bes.existingFiles'),
    newHeading: text('bes.newFiles'),
    noNewFiles: text('bes.noNewFiles'),
    removeLabel: text('actions.remove'),
    existing,
    added: added.map((file) => ({
      ...file,
      deleteUrl: respondUrl(
        ctx.params,
        ctx.item.itemId,
        ctx.currentLocale,
        `bes-evidence/${encodeURIComponent(file.fileId)}/delete`
      )
    })),
    validFromDay: payload.validFromDay ?? '',
    validFromMonth: payload.validFromMonth ?? '',
    validFromYear: payload.validFromYear ?? '',
    validToDay: payload.validToDay ?? '',
    validToMonth: payload.validToMonth ?? '',
    validToYear: payload.validToYear ?? '',
    ...errors
  })
}

function validateFile(ctx, uploadedFile) {
  const { t } = ctx
  if (hasMaxBesEvidenceFiles(allFiles(ctx))) {
    return t('pages.uploadBesEvidence.validation.maxFiles')
  }
  const filename = uploadedFile?.filename ?? ''
  if (!filename) {
    return t('pages.uploadBesEvidence.validation.noFile')
  }
  if (!validateFileExtension(filename)) {
    return t('pages.uploadBesEvidence.validation.invalidType')
  }
  if (uploadedFile.payload.length > MAX_FILE_BYTES) {
    return t('pages.uploadBesEvidence.validation.fileTooLarge')
  }
  if (isFilenameAmong(filename, filenamesInUse(ctx))) {
    return t('pages.uploadBesEvidence.validation.duplicateFilename')
  }
  return null
}

function validateDates(ctx, payload) {
  const { t } = ctx
  const validFrom = parseDate(
    payload.validFromDay,
    payload.validFromMonth,
    payload.validFromYear
  )
  if (!validFrom) {
    return {
      errors: {
        validFromError: t(
          'pages.uploadBesEvidence.validation.validFromRequired'
        )
      }
    }
  }
  const { validTo, error } = resolveBesEvidenceValidTo(payload, validFrom, t)
  return error ? { errors: { validToError: error } } : { validFrom, validTo }
}

async function startUpload(ctx, file, { validFrom, validTo }) {
  const { organisationId, applicationId, item, request } = ctx
  const besEvidenceValidFromDate = validFrom.toISOString()
  const besEvidenceExpiryDate = validTo?.toISOString() ?? null
  const statusPath = respondUrl(
    ctx.params,
    item.itemId,
    '',
    'bes-evidence/status'
  )
  const uploadDetail = await initUpload({
    initiateUrl: accreditationChangesService.itemBesEvidenceInitiateUrl(
      organisationId,
      applicationId,
      item.itemId
    ),
    redirectUrl: `${config.get('auth.callbackBaseUrl')}${statusPath}`,
    s3Path: `accreditation-changes/bes-evidence/${applicationId}/${item.itemId}`,
    s3Bucket: config.get('fileUpload.s3Bucket'),
    metadata: { besEvidenceValidFromDate, besEvidenceExpiryDate },
    mimeTypes: ALLOWED_MIME_TYPES,
    maxFileSize: MAX_FILE_BYTES
  })
  await proxyUploadToCdp({
    uploadUrl: uploadDetail.uploadUrl,
    payload: file.payload,
    filename: file.filename,
    contentType: file.headers['content-type']
  })
  request.yar.set(RESPOND_BES_UPLOAD_SESSION_KEY, {
    statusUrl: uploadDetail.statusUrl,
    fileUploadId: uploadDetail.fileUploadId,
    itemId: item.itemId,
    besEvidenceValidFromDate,
    besEvidenceExpiryDate
  })
}

export const besGetController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const fileError =
      uploadRejectionErrorFromQuery(request, ctx.t) ??
      (request.query?.reason === 'uploadFailed'
        ? ctx.t('pages.uploadBesEvidence.validation.uploadError')
        : undefined)
    return renderPage(h, ctx, {}, fileError ? { fileError } : {})
  }
}

export const besPostController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const payload = request.payload ?? {}
    const rejected = (errors) =>
      renderPage(h, ctx, payload, errors).code(statusCodes.badRequest)

    const fileError = validateFile(ctx, payload.file)
    if (fileError) {
      return rejected({ fileError })
    }
    const dates = validateDates(ctx, payload)
    if (dates.errors) {
      return rejected(dates.errors)
    }
    try {
      await startUpload(ctx, payload.file, dates)
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { itemId: ctx.item.itemId },
        'Error uploading BES evidence in response to a query'
      )
      return renderPage(h, ctx, payload, {
        fileError: ctx.t('pages.uploadBesEvidence.validation.uploadError')
      }).code(statusCodes.internalServerError)
    }
    return h.redirect(
      respondUrl(
        ctx.params,
        ctx.item.itemId,
        ctx.currentLocale,
        'bes-evidence/status'
      )
    )
  }
}

/**
 * Runs before the upload-status lookup: an upload this session did not start
 * for this item is never attached to it.
 */
export const requireUploadForItem = {
  method(request, h) {
    const upload = request.yar.get(RESPOND_BES_UPLOAD_SESSION_KEY)
    if (upload?.statusUrl && upload.itemId === request.params.itemId) {
      return h.continue
    }
    const { currentLocale } = getLocaleAndTranslator(request)
    return h
      .redirect(`${localePrefix(currentLocale)}${besUploadUrl(request.params)}`)
      .takeover()
  }
}

export function besUploadUrl(params) {
  const { organisationId, registrationNumber, materialType, itemId } = params
  return `/manage/${organisationId}/${encodeURIComponent(registrationNumber)}/${materialType}/change-requests/${encodeURIComponent(itemId)}/bes-evidence`
}

export const besStatusController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const { t } = ctx
    const uploadStatus = request.pre.uploadStatus
    if (uploadStatus?.uploadStatus !== 'ready') {
      return h.view('accreditation/upload-bes-evidence/status', {
        pageTitle: t('pages.uploadBesEvidence.status.title'),
        heading: t('pages.uploadBesEvidence.status.heading'),
        processingStatus: uploadStatus.processingStatus ?? 'preprocessing'
      })
    }
    const upload = request.yar.get(RESPOND_BES_UPLOAD_SESSION_KEY)
    request.yar.clear(RESPOND_BES_UPLOAD_SESSION_KEY)
    const uploadPage = respondUrl(
      ctx.params,
      ctx.item.itemId,
      ctx.currentLocale,
      'bes-evidence'
    )
    if (uploadStatus.form?.file?.hasError) {
      return h.redirect(`${uploadPage}?${UPLOAD_FAILED_QUERY}`)
    }
    try {
      await accreditationChangesService.addItemBesFile(
        ctx.organisationId,
        ctx.applicationId,
        ctx.item.itemId,
        {
          fileUploadId: upload.fileUploadId,
          besEvidenceValidFromDate: upload.besEvidenceValidFromDate,
          besEvidenceExpiryDate: upload.besEvidenceExpiryDate
        }
      )
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { itemId: ctx.item.itemId },
        'Error saving BES evidence in response to a query'
      )
      const rejection = uploadRejectionQuery(err) ?? UPLOAD_FAILED_QUERY
      return h.redirect(`${uploadPage}?${rejection}`)
    }
    request.yar.flash(
      FLASH_UPDATED,
      ctx.t('pages.manageChangeRequests.respond.fieldLabels.besEvidence')
    )
    return h.redirect(ctx.itemUrl)
  }
}

export const besDeleteController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const uploadPage = respondUrl(
      ctx.params,
      ctx.item.itemId,
      ctx.currentLocale,
      'bes-evidence'
    )
    try {
      await accreditationChangesService.deleteItemBesFile(
        ctx.organisationId,
        ctx.applicationId,
        ctx.item.itemId,
        request.params.fileId
      )
    } catch (err) {
      // 404: already gone. 422: it was there before the query, so it stays.
      if (
        err.status !== statusCodes.notFound &&
        err.status !== statusCodes.unprocessableEntity
      ) {
        logStructuredError(
          request.logger,
          err,
          { itemId: ctx.item.itemId },
          'Error deleting BES evidence in response to a query'
        )
        return renderPage(
          h,
          ctx,
          {},
          {
            fileError: ctx.t(
              'pages.manageChangeRequests.respond.bes.removeError'
            )
          }
        ).code(statusCodes.internalServerError)
      }
    }
    return h.redirect(uploadPage)
  }
}
