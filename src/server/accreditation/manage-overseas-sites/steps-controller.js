import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { COUNTRIES } from '../../common/data/countries.js'
import { validateSiteLocationFields } from '../../common/helpers/overseasSiteLocationValidation.js'
import {
  applicableCodesForMaterialType,
  validateRecyclingOperationCodes
} from '../../common/helpers/overseasSiteAnswerValidation.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { buildViewData as buildRecyclingViewData } from '../add-overseas-site/recycling-operation-details/controller.js'
import { buildViewData as buildConditionsViewData } from '../add-overseas-site/conditions-of-export/controller.js'
import {
  uploadRejectionErrorFromQuery,
  buildViewData as buildBesViewData
} from '../upload-bes-evidence/controller.js'
import {
  accreditationChangesService,
  conflictMessage,
  validationErrors
} from '../../common/helpers/accreditationChangesService.js'
import {
  besFileContext,
  besUploadStatusPre,
  completeBesUpload,
  postBesUpload
} from './bes-upload.js'
import {
  loadView,
  organisationIdFrom,
  redirectToManageSites,
  resolveDraftSite
} from './controller.js'
import { refusal, refusedFields } from './refusals.js'
import { addToAccreditationUrl, stepUrl } from './urls.js'

// RA-492: the "Add information" / "Change" steps behind the Add to
// accreditation summary. Each captures one of the fields the backend lets
// the operator supply for a registered ORS (country, coordinates, R code,
// conditions of export, BES evidence), renders the add-overseas-site
// journey's own template for it, and PATCHes the draft request before
// returning to the summary. A field already recorded on the ORS is locked:
// its step redirects to the summary and the backend refuses it too.

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
    return { redirect: await redirectToManageSites(request, h, view) }
  }
  const locked = new Set(draft.entry.lockedFields)
  const open = fields.filter((field) => !locked.has(field))
  if (open.length === 0) {
    return {
      redirect: h.redirect(addToAccreditationUrl(applicationId, siteId))
    }
  }
  return { ...draft, open, locked, materialType: view.materialType, view }
}

/**
 * A step's route handler: loads the draft site for the fields it edits and
 * redirects when the step cannot be used (see loadStep), otherwise runs the
 * step with the translator and the draft.
 */
function stepHandler(fields, step) {
  return {
    async handler(request, h) {
      const draft = await loadStep(request, h, fields)
      if (draft.redirect) {
        return draft.redirect
      }
      const { t } = getLocaleAndTranslator(request)
      return step(request, h, t, draft)
    }
  }
}

function effectiveValue(draft, field) {
  return draft.requestSite.effective?.[field] ?? draft.entry.site?.[field]
}

export function besEvidenceUrl(applicationId, siteId) {
  return stepUrl(applicationId, siteId, 'bes-evidence')
}

function stepUrls(request) {
  const { applicationId, siteId } = request.params
  const summary = addToAccreditationUrl(applicationId, siteId)
  return { backLink: summary, cancelUrl: summary, summary }
}

/**
 * PATCHes the draft. Returns null when it saved, or errors keyed by field
 * when it was refused: the backend's own on a 400 (a field that became
 * locked, or one that failed its rules, possibly none it can name), or a
 * 409's message once, against the first field sent (the site was already
 * sent to the regulator, or the draft was changed elsewhere).
 */
async function patchSite(request, body) {
  const { applicationId, siteId } = request.params
  try {
    await accreditationChangesService.patchSite(
      organisationIdFrom(request),
      applicationId,
      siteId,
      body
    )
    return null
  } catch (err) {
    if (err.status === statusCodes.badRequest) {
      return validationErrors(err)
    }
    const message =
      err.status === statusCodes.conflict ? conflictMessage(err) : null
    if (message) {
      return { [Object.keys(body)[0]]: message }
    }
    throw err
  }
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

export const locationGetController = stepHandler(
  ['country', 'coordinates'],
  async (request, h, t, draft) => {
    const fields = {
      country: effectiveValue(draft, 'country') ?? '',
      coordinates: effectiveValue(draft, 'coordinates') ?? ''
    }
    return locationView(h, t, request, draft, fields, {})
  }
)

export const locationPostController = stepHandler(
  ['country', 'coordinates'],
  async (request, h, t, draft) => {
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
      return locationView(h, t, request, draft, fields, errors).code(
        statusCodes.badRequest
      )
    }
    const body = Object.fromEntries(
      draft.open.map((field) => [field, fields[field]])
    )
    const apiErrors = await patchSite(request, body)
    if (apiErrors) {
      const shown = refusedFields(t, apiErrors, draft.open)
      return locationView(h, t, request, draft, fields, shown).code(
        statusCodes.badRequest
      )
    }
    return h.redirect(stepUrls(request).summary)
  }
)

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

export const recyclingOperationGetController = stepHandler(
  ['operationCodes'],
  async (request, h, t, draft) => {
    return recyclingView(
      h,
      t,
      request,
      draft,
      effectiveValue(draft, 'operationCodes') ?? [],
      null
    )
  }
)

export const recyclingOperationPostController = stepHandler(
  ['operationCodes'],
  async (request, h, t, draft) => {
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
      return recyclingView(h, t, request, draft, codes, error).code(
        statusCodes.badRequest
      )
    }
    return h.redirect(stepUrls(request).summary)
  }
)

// --- Conditions of export --------------------------------------------------

// The template's radio values for a saved answer; none selected when unset.
const RADIO_VALUE = { true: 'yes', false: 'no' }

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

export const conditionsOfExportGetController = stepHandler(
  ['conditionsOfExport'],
  async (request, h, t, draft) => {
    const selected = RADIO_VALUE[effectiveValue(draft, 'conditionsOfExport')]
    return conditionsView(h, t, request, selected, null)
  }
)

export const conditionsOfExportPostController = stepHandler(
  ['conditionsOfExport'],
  async (request, h, t) => {
    const value = request.payload?.conditionsOfExport
    if (value !== 'yes' && value !== 'no') {
      return conditionsView(
        h,
        t,
        request,
        null,
        t('pages.addOverseasSite.conditionsOfExport.validation.required')
      ).code(statusCodes.badRequest)
    }
    const error = refusal(
      t,
      await patchSite(request, { conditionsOfExport: value === 'yes' }),
      'conditionsOfExport'
    )
    if (error) {
      return conditionsView(h, t, request, value, error).code(
        statusCodes.badRequest
      )
    }
    return h.redirect(stepUrls(request).summary)
  }
)

// --- Evidence of broadly equivalent standards ------------------------------

function besView(h, t, request, draft, payload, errors) {
  const siteName = draft.entry.site.siteName
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

export const besEvidenceGetController = stepHandler(
  ['besEvidence'],
  async (request, h, t, draft) => {
    return besView(
      h,
      t,
      request,
      draft,
      {},
      {
        fileError: uploadRejectionErrorFromQuery(request, t)
      }
    )
  }
)

function besStatusUrl({ applicationId, siteId }) {
  return stepUrl(applicationId, siteId, 'bes-evidence/status')
}

export const besEvidencePostController = stepHandler(
  ['besEvidence'],
  async (request, h, t, draft) =>
    postBesUpload(request, h, t, {
      files: besFileContext(draft.view, draft.entry.site, draft.requestSite),
      render: (payload, errors) =>
        besView(h, t, request, draft, payload, errors),
      statusUrl: besStatusUrl(request.params),
      doneUrl: stepUrls(request).summary
    })
)

export const besEvidenceStatusPre = besUploadStatusPre(
  ({ applicationId, siteId }) => besEvidenceUrl(applicationId, siteId)
)

// The file is attached to the route's site only, and only while that site
// is still in the draft with BES evidence open to it (see loadStep).
export const besEvidenceStatusController = stepHandler(
  ['besEvidence'],
  async (request, h, t) => {
    const { applicationId, siteId } = request.params
    return completeBesUpload(request, h, t, {
      uploadUrl: besEvidenceUrl(applicationId, siteId),
      attach: async (body) => {
        await accreditationChangesService.addBesEvidenceFile(
          organisationIdFrom(request),
          applicationId,
          siteId,
          body
        )
        return null
      },
      doneUrl: addToAccreditationUrl(applicationId, siteId)
    })
  }
)
