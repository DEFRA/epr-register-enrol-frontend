import { config } from '../../../config/config.js'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { COUNTRIES } from '../../common/data/countries.js'
import { validateSiteLocationFields } from '../../common/helpers/overseasSiteLocationValidation.js'
import {
  applicableCodesForMaterialType,
  validateRecyclingOperationCodes
} from '../../common/helpers/overseasSiteAnswerValidation.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { proxyUploadToCdp } from '../../common/helpers/upload/proxy-upload-to-cdp.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { buildViewData as buildRecyclingViewData } from '../add-overseas-site/recycling-operation-details/controller.js'
import { buildViewData as buildConditionsViewData } from '../add-overseas-site/conditions-of-export/controller.js'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  buildViewData as buildBesViewData,
  parseDate,
  resolveBesEvidenceValidTo,
  validateFileExtension
} from '../upload-bes-evidence/controller.js'
import { accreditationChangesService, validationErrors } from './service.js'
import { loadView, organisationIdFrom, resolveDraftSite } from './controller.js'
import {
  addToAccreditationUrl,
  manageOverseasSitesUrl,
  stepUrl
} from './urls.js'

// RA-492: the "Add information" / "Change" steps behind the Add to
// accreditation summary. Each captures one of the fields the backend lets
// the operator supply for a registered ORS (country, coordinates, R code,
// conditions of export, BES evidence), renders the add-overseas-site
// journey's own template for it, and PATCHes the draft request before
// returning to the summary. A field already recorded on the ORS is locked:
// its step redirects to the summary and the backend refuses it too.

export const IN_YEAR_BES_UPLOAD_SESSION_KEY = 'inYearBesEvidenceUpload'

const VIEWS = {
  location: 'accreditation/manage-overseas-sites/location',
  recycling:
    'accreditation/add-overseas-site/recycling-operation-details/index',
  conditions: 'accreditation/add-overseas-site/conditions-of-export/index',
  bes: 'accreditation/upload-bes-evidence/index'
}

/**
 * Loads the draft site for a step. Returns {redirect} when the step cannot
 * be used: the site is not in the draft (or is in a submitted request,
 * AC09) -> Manage ORS; every field the step edits is locked -> summary.
 */
async function loadStep(request, h, fields) {
  const { applicationId, siteId } = request.params
  const view = await loadView(request)
  const draft = resolveDraftSite(view, siteId)
  if (!draft) {
    return { redirect: h.redirect(manageOverseasSitesUrl(applicationId)) }
  }
  const locked = new Set(draft.entry.lockedFields ?? [])
  const open = fields.filter((field) => !locked.has(field))
  if (open.length === 0) {
    return {
      redirect: h.redirect(addToAccreditationUrl(applicationId, siteId))
    }
  }
  return { ...draft, open, locked, materialType: view.materialType }
}

function effectiveValue(draft, field) {
  return draft.requestSite.effective?.[field] ?? draft.entry.site?.[field]
}

function stepUrls(request) {
  const { applicationId, siteId } = request.params
  const summary = addToAccreditationUrl(applicationId, siteId)
  return { backLink: summary, cancelUrl: summary, summary }
}

/**
 * PATCHes the draft. Returns null when it saved, or the backend's field
 * errors (possibly none it can name) when it refused the answer with a 400
 * - a field that became locked, or one that failed its rules.
 */
async function patchSite(request, body) {
  const { applicationId, siteId } = request.params
  try {
    await accreditationChangesService.patchSite(
      organisationIdFrom(request),
      applicationId,
      Number.parseInt(siteId, 10),
      body
    )
    return null
  } catch (err) {
    if (err.status === 400) {
      return validationErrors(err)
    }
    throw err
  }
}

/**
 * The message to show against one field after a PATCH: the backend's own
 * message for it (keys matched case-insensitively, as ASP.NET may send
 * them), a general one when the answer was refused without naming the
 * field, or null when it saved.
 */
function refusal(t, errors, field) {
  if (errors === null) {
    return null
  }
  const key = Object.keys(errors).find(
    (name) => name.toLowerCase() === field.toLowerCase()
  )
  return (
    [key ? errors[key] : null].flat().find(Boolean) ??
    t('pages.manageOverseasSites.saveRefused')
  )
}

// --- Location: country and coordinates -------------------------------------

function locationView(h, t, request, draft, fields, errors) {
  return h.view(VIEWS.location, {
    pageTitle: t('pages.addOverseasSite.siteLocation.title'),
    heading: t('pages.addOverseasSite.siteLocation.heading'),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    countries: COUNTRIES,
    ...stepUrls(request),
    locked: {
      country: draft.locked.has('country')
        ? effectiveValue(draft, 'country')
        : null,
      coordinates: draft.locked.has('coordinates')
        ? effectiveValue(draft, 'coordinates')
        : null
    },
    fields,
    errors
  })
}

export const locationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['country', 'coordinates'])
    if (draft.redirect) {
      return draft.redirect
    }
    const fields = {
      country: effectiveValue(draft, 'country') ?? '',
      coordinates: effectiveValue(draft, 'coordinates') ?? ''
    }
    return locationView(h, t, request, draft, fields, {})
  }
}

export const locationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['country', 'coordinates'])
    if (draft.redirect) {
      return draft.redirect
    }
    const fields = {
      country: (request.payload?.country ?? '').trim(),
      coordinates: (request.payload?.coordinates ?? '').trim()
    }
    // Same rules as the add-overseas-site location page, for the fields
    // this page edits (the address is not part of an in-year request).
    const allErrors = validateSiteLocationFields(t, fields)
    const errors = Object.fromEntries(
      draft.open
        .filter((field) => allErrors[field])
        .map((field) => [field, allErrors[field]])
    )
    if (Object.keys(errors).length > 0) {
      return locationView(h, t, request, draft, fields, errors).code(400)
    }
    const body = Object.fromEntries(
      draft.open.map((field) => [field, fields[field]])
    )
    const apiErrors = await patchSite(request, body)
    if (apiErrors) {
      const named = draft.open.filter((field) =>
        Object.keys(apiErrors).some(
          (name) => name.toLowerCase() === field.toLowerCase()
        )
      )
      // A refusal that names neither field is shown against the first one.
      const shown = Object.fromEntries(
        (named.length > 0 ? named : draft.open.slice(0, 1)).map((field) => [
          field,
          refusal(t, apiErrors, field)
        ])
      )
      return locationView(h, t, request, draft, fields, shown).code(400)
    }
    return h.redirect(stepUrls(request).summary)
  }
}

// --- Recycling operation (R code) ------------------------------------------

function recyclingView(h, t, request, draft, selected, error) {
  return h.view(VIEWS.recycling, {
    ...buildRecyclingViewData(
      t,
      request.params.applicationId,
      applicableCodesForMaterialType(draft.materialType),
      selected,
      error
    ),
    ...stepUrls(request)
  })
}

export const recyclingOperationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['operationCodes'])
    if (draft.redirect) {
      return draft.redirect
    }
    return recyclingView(
      h,
      t,
      request,
      draft,
      effectiveValue(draft, 'operationCodes') ?? [],
      null
    )
  }
}

export const recyclingOperationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['operationCodes'])
    if (draft.redirect) {
      return draft.redirect
    }
    const raw = request.payload?.recyclingOperationCodes
    const codes = [raw ?? []]
      .flat()
      .map((code) => (typeof code === 'string' ? code.trim() : ''))
      .filter(Boolean)
    const error =
      validateRecyclingOperationCodes(t, codes, draft.materialType) ??
      refusal(
        t,
        await patchSite(request, { operationCodes: codes }),
        'operationCodes'
      )
    if (error) {
      return recyclingView(h, t, request, draft, codes, error).code(400)
    }
    return h.redirect(stepUrls(request).summary)
  }
}

// --- Conditions of export --------------------------------------------------

function conditionsView(h, t, request, selected, error) {
  return h.view(VIEWS.conditions, {
    ...buildConditionsViewData(
      t,
      request.params.applicationId,
      selected,
      error
    ),
    ...stepUrls(request)
  })
}

export const conditionsOfExportGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['conditionsOfExport'])
    if (draft.redirect) {
      return draft.redirect
    }
    const value = effectiveValue(draft, 'conditionsOfExport')
    const selected = value === true ? 'yes' : value === false ? 'no' : null
    return conditionsView(h, t, request, selected, null)
  }
}

export const conditionsOfExportPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['conditionsOfExport'])
    if (draft.redirect) {
      return draft.redirect
    }
    const value = request.payload?.conditionsOfExport
    if (value !== 'yes' && value !== 'no') {
      return conditionsView(
        h,
        t,
        request,
        null,
        t('pages.addOverseasSite.conditionsOfExport.validation.required')
      ).code(400)
    }
    const error = refusal(
      t,
      await patchSite(request, { conditionsOfExport: value === 'yes' }),
      'conditionsOfExport'
    )
    if (error) {
      return conditionsView(h, t, request, value, error).code(400)
    }
    return h.redirect(stepUrls(request).summary)
  }
}

// --- Evidence of broadly equivalent standards ------------------------------

function besView(h, t, request, draft, payload, errors) {
  const siteName = draft.entry.site?.siteName ?? ''
  return h.view(VIEWS.bes, {
    ...buildBesViewData(
      t,
      request.params.applicationId,
      siteName,
      payload,
      errors
    ),
    ...stepUrls(request),
    // The in-year flow has no BES task list; "save and come back later"
    // returns to the summary instead.
    taskListLink: stepUrls(request).summary
  })
}

function validateBesFile(t, uploadedFile) {
  const filename = uploadedFile?.filename ?? ''
  if (!filename) {
    return t('pages.uploadBesEvidence.validation.noFile')
  }
  if (!validateFileExtension(filename)) {
    return t('pages.uploadBesEvidence.validation.invalidType')
  }
  if ((uploadedFile?.payload?.length ?? 0) > MAX_FILE_BYTES) {
    return t('pages.uploadBesEvidence.validation.fileTooLarge')
  }
  return null
}

export const besEvidenceGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const draft = await loadStep(request, h, ['besEvidence'])
    if (draft.redirect) {
      return draft.redirect
    }
    return besView(h, t, request, draft, {}, {})
  }
}

export const besEvidencePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const draft = await loadStep(request, h, ['besEvidence'])
    if (draft.redirect) {
      return draft.redirect
    }
    const payload = request.payload ?? {}
    if (payload.action === 'saveAndComeLater') {
      return h.redirect(stepUrls(request).summary)
    }
    const fileError = validateBesFile(t, payload.file)
    if (fileError) {
      return besView(h, t, request, draft, payload, { fileError }).code(400)
    }
    const validFrom = parseDate(
      payload.validFromDay,
      payload.validFromMonth,
      payload.validFromYear
    )
    if (!validFrom) {
      return besView(h, t, request, draft, payload, {
        validFromError: t(
          'pages.uploadBesEvidence.validation.validFromRequired'
        )
      }).code(400)
    }
    const { validTo, error: validToError } = resolveBesEvidenceValidTo(
      payload,
      validFrom,
      t
    )
    if (validToError) {
      return besView(h, t, request, draft, payload, { validToError }).code(400)
    }
    const besEvidenceValidFromDate = validFrom.toISOString()
    const besEvidenceExpiryDate = validTo ? validTo.toISOString() : null
    const organisationId = organisationIdFrom(request)

    try {
      const uploadDetail = await initUpload({
        initiateUrl: accreditationChangesService.besEvidenceInitiateUrl(
          organisationId,
          applicationId
        ),
        redirectUrl: `${config.get('auth.callbackBaseUrl')}${stepUrl(applicationId, siteId, 'bes-evidence/status')}`,
        s3Path: `accreditation-changes/bes-evidence/${applicationId}/${siteId}`,
        s3Bucket: config.get('fileUpload.s3Bucket'),
        metadata: { besEvidenceValidFromDate, besEvidenceExpiryDate },
        mimeTypes: ALLOWED_MIME_TYPES,
        maxFileSize: MAX_FILE_BYTES
      })
      await proxyUploadToCdp({
        uploadUrl: uploadDetail.uploadUrl,
        payload: payload.file.payload,
        filename: payload.file.filename,
        contentType:
          payload.file.headers?.['content-type'] ?? 'application/octet-stream'
      })
      request.yar.set(IN_YEAR_BES_UPLOAD_SESSION_KEY, {
        statusUrl: uploadDetail.statusUrl,
        fileUploadId: uploadDetail.fileUploadId,
        siteId: Number.parseInt(siteId, 10),
        besEvidenceValidFromDate,
        besEvidenceExpiryDate
      })
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId },
        `Error uploading in-year BES evidence for site ${siteId}, application ${applicationId}`
      )
      return besView(h, t, request, draft, payload, {
        fileError: t('pages.uploadBesEvidence.validation.uploadError')
      }).code(500)
    }
    return h.redirect(stepUrl(applicationId, siteId, 'bes-evidence/status'))
  }
}

export const besEvidenceStatusController = {
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
    const session = request.yar.get(IN_YEAR_BES_UPLOAD_SESSION_KEY)
    request.yar.clear(IN_YEAR_BES_UPLOAD_SESSION_KEY)
    if (uploadStatus.form?.file?.hasError) {
      return h.redirect(stepUrl(applicationId, siteId, 'bes-evidence'))
    }
    try {
      await accreditationChangesService.addBesEvidenceFile(
        organisationIdFrom(request),
        applicationId,
        session?.siteId ?? Number.parseInt(siteId, 10),
        {
          fileUploadId: session?.fileUploadId,
          besEvidenceValidFromDate: session?.besEvidenceValidFromDate,
          besEvidenceExpiryDate: session?.besEvidenceExpiryDate
        }
      )
    } catch (err) {
      // 422: not scanned clean, or a duplicate filename. The summary still
      // shows the evidence as missing, so the operator can try again.
      logStructuredError(
        request.server.logger,
        err,
        { siteId, applicationId },
        `Error saving in-year BES evidence for site ${siteId}, application ${applicationId}`
      )
    }
    return h.redirect(addToAccreditationUrl(applicationId, siteId))
  }
}
