import { config } from '../../../config/config.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { isFilenameAmong } from '../../common/helpers/duplicateFilename.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../common/helpers/upload/proxy-upload-to-cdp.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'
import { accreditationChangesService } from '../../common/helpers/accreditationChangesService.js'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  hasMaxBesEvidenceFiles,
  parseDate,
  resolveBesEvidenceValidTo,
  uploadRejectionQuery,
  validateFileExtension
} from '../upload-bes-evidence/controller.js'
import { organisationIdFrom } from './controller.js'
import { besUploadsOf, grantedBesUploads } from './view-model.js'

// RA-492's upload of a site's BES evidence to the draft change request, through
// the CDP uploader. RA-682's update of an accredited ORS uploads new evidence
// the same way, from its own pages.

export const IN_YEAR_BES_UPLOAD_SESSION_KEY = 'inYearBesEvidenceUpload'

/**
 * The files RA-605's cap and RA-571's duplicate filename rule count for a
 * site. 3bb.38: a grant adds the request's files to the site's own on the
 * accreditation, so the cap counts both, and the name rule takes in every
 * site's files there as well as the request's. The backend also checks the
 * accreditation's sampling plan files, which the view lacks.
 */
export function besFileContext(view, site, requestSite) {
  const { held, added } = grantedBesUploads(site, requestSite)
  return {
    granted: [...held, ...added],
    filenames: [
      ...(view.sites ?? []).map((entry) => entry.site),
      ...(view.activeRequest?.sites ?? [])
    ].flatMap((holder) => besUploadsOf(holder).map((f) => f?.filename))
  }
}

// RA-605's cap comes first, as on the application's upload page: a site
// already at the cap gets that message whatever file was chosen.
function validateBesFile(t, uploadedFile, files) {
  if (hasMaxBesEvidenceFiles(files.granted)) {
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
  if (isFilenameAmong(filename, files.filenames)) {
    return t('pages.uploadBesEvidence.validation.duplicateFilename')
  }
  return null
}

function checkBesUpload(t, payload, files) {
  const fileError = validateBesFile(t, payload.file, files)
  if (fileError) {
    return { errors: { fileError } }
  }
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

async function uploadToRequest(request, file, { validFrom, validTo }, status) {
  const { applicationId, siteId } = request.params
  const besEvidenceValidFromDate = validFrom.toISOString()
  const besEvidenceExpiryDate = validTo?.toISOString() ?? null
  const uploadDetail = await initUpload({
    initiateUrl: accreditationChangesService.besEvidenceInitiateUrl(
      organisationIdFrom(request),
      applicationId
    ),
    redirectUrl: `${config.get('auth.callbackBaseUrl')}${status}`,
    s3Path: `accreditation-changes/bes-evidence/${applicationId}/${siteId}`,
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
  request.yar.set(IN_YEAR_BES_UPLOAD_SESSION_KEY, {
    statusUrl: uploadDetail.statusUrl,
    fileUploadId: uploadDetail.fileUploadId,
    siteId,
    besEvidenceValidFromDate,
    besEvidenceExpiryDate
  })
}

/**
 * The upload page's POST: checks the file and its dates, sends the file to
 * the CDP uploader through the change request's own initiate endpoint and
 * goes on to `statusUrl`. `render(payload, errors)` shows the page again.
 */
export async function postBesUpload(
  request,
  h,
  t,
  { files, render, statusUrl, doneUrl }
) {
  const { applicationId, siteId } = request.params
  const payload = request.payload ?? {}
  if (payload.action === 'saveAndComeLater') {
    return h.redirect(doneUrl)
  }
  const checked = checkBesUpload(t, payload, files)
  if (checked.errors) {
    return render(payload, checked.errors).code(statusCodes.badRequest)
  }
  try {
    await uploadToRequest(request, payload.file, checked, statusUrl)
  } catch (err) {
    logStructuredError(
      request.server.logger,
      err,
      { siteId, applicationId },
      `Error uploading in-year BES evidence for site ${siteId}, application ${applicationId}`
    )
    return render(payload, {
      fileError: t('pages.uploadBesEvidence.validation.uploadError')
    }).code(statusCodes.internalServerError)
  }
  return h.redirect(statusUrl)
}

/**
 * The status page's pre-handlers. An upload this session did not start for
 * the route's site (expired, another tab, or another site) is never attached
 * there, so the operator goes back to that site's upload page instead.
 */
export function besUploadStatusPre(uploadUrlFor) {
  const requireUploadForSite = {
    method(request, h) {
      const upload = request.yar.get(IN_YEAR_BES_UPLOAD_SESSION_KEY)
      if (upload?.statusUrl && upload.siteId === request.params.siteId) {
        return h.continue
      }
      return h.redirect(uploadUrlFor(request.params)).takeover()
    }
  }
  return [
    requireUploadForSite,
    provideUploadStatusFromSession(IN_YEAR_BES_UPLOAD_SESSION_KEY, uploadUrlFor)
  ]
}

/**
 * The status page: polls until the upload is ready, then `attach`es the file
 * to the route's site and goes on to `doneUrl`. `attach` returns a response
 * when the save was refused in a way it shows itself.
 */
export async function completeBesUpload(
  request,
  h,
  t,
  { uploadUrl, attach, doneUrl }
) {
  const { applicationId, siteId } = request.params
  const uploadStatus = request.pre.uploadStatus
  if (uploadStatus?.uploadStatus !== 'ready') {
    return h.view('accreditation/upload-bes-evidence/status', {
      pageTitle: t('pages.uploadBesEvidence.status.title'),
      heading: t('pages.uploadBesEvidence.status.heading'),
      processingStatus: uploadStatus.processingStatus ?? 'preprocessing'
    })
  }
  const upload = request.yar.get(IN_YEAR_BES_UPLOAD_SESSION_KEY)
  request.yar.clear(IN_YEAR_BES_UPLOAD_SESSION_KEY)
  if (uploadStatus.form?.file?.hasError) {
    return h.redirect(uploadUrl)
  }
  try {
    const refused = await attach({
      fileUploadId: upload.fileUploadId,
      besEvidenceValidFromDate: upload.besEvidenceValidFromDate,
      besEvidenceExpiryDate: upload.besEvidenceExpiryDate
    })
    if (refused) {
      return refused
    }
  } catch (err) {
    // 422: not scanned clean, a duplicate filename (3bb.48: one the upload
    // page could not check, such as a sampling plan file's), or (RA-605) the
    // site already has the most files allowed. The last two go back to the
    // upload page with their message; otherwise the evidence is still shown
    // as it was, so the operator can try again.
    logStructuredError(
      request.server.logger,
      err,
      { siteId, applicationId },
      `Error saving in-year BES evidence for site ${siteId}, application ${applicationId}`
    )
    const rejection = uploadRejectionQuery(err)
    if (rejection) {
      return h.redirect(`${uploadUrl}?${rejection}`)
    }
  }
  return h.redirect(doneUrl)
}
