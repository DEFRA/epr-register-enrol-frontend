import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import {
  findBpItem,
  DETAIL_FIELD_TO_CATEGORY
} from '../business-plan/helpers.js'
import { BUSINESS_PLAN_DETAIL_FIELDS } from '../../common/constants/businessPlanCategories.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

// RA-456: derived from the shared category map — see
// common/constants/businessPlanCategories.js
export const DETAIL_FIELDS = BUSINESS_PLAN_DETAIL_FIELDS

const MAX_CHARS = 500

// A native <textarea maxlength="500"> counts a line break as a single "\n"
// character — that's what the browser enforces while the operator is
// typing, and it's what the GOV.UK character-count JS enhancement counts too
// (it reads textarea.value.length, and a DOM textarea's value never contains
// "\r"). But per the HTML forms spec, when the browser BUILDS the submitted
// request body it normalises every line break in a textarea's value to CRLF
// ("\r\n") before percent-encoding it — see "5.1 application/x-www-form-
// urlencoded encoding algorithm" in the HTML Living Standard. So a value the
// operator typed at exactly the 500-character limit arrives here longer by
// one extra character per line break it contains, and a raw `.length` check
// rejects text the operator was never able to exceed. Normalising back to
// LF-only here is what makes the server count the same way the browser (and
// its own maxlength attribute) already did.
function normaliseNewlines(value) {
  return (value ?? '').replace(/\r\n|\r/g, '\n')
}

export function validateDetailFields(payload, t, application) {
  const errors = {}

  for (const field of DETAIL_FIELDS) {
    if (application) {
      const category = DETAIL_FIELD_TO_CATEGORY[field]
      const item = findBpItem(application.businessPlan, category)
      if ((item.percentSpent ?? 0) <= 0) {
        continue
      }
    }

    const value = normaliseNewlines(payload[field])
    if (value.length > MAX_CHARS) {
      const label = t(`pages.businessPlanDetail.fields.${field}`)
      errors[field] = {
        text: t('pages.businessPlanDetail.validation.tooLong').replace(
          '{field}',
          label
        ),
        // RA-268: distinguishes this from the "required" error below, which
        // shares the same errorMessage slot in buildTextareaInputs but isn't
        // a length rule — see the comment there for why that distinction
        // matters to the client.
        tooLong: true
      }
    } else if (application && !value.trim()) {
      errors[field] = {
        text: t('pages.businessPlanDetail.validation.requiredWhenPercent')
      }
    }
  }

  return errors
}

// RA-268: each field is handed to GOV.UK Frontend's own govukCharacterCount
// macro (already used the same way on withdraw-application's reason field),
// so the keys here are macro parameter names, not free-form view data. The
// macro's JS progressively enhances the plain maxlength-capped textarea into
// a live "characters remaining"/"characters too many" counter that updates on
// every keystroke, entirely client-side and before any submit. That is on
// top of, never instead of, the server-side check in validateDetailFields:
// without JS (or if the two ever disagreed) the textarea's native maxlength
// and the check above are still the real gate.
//
// The live counter updating is NOT the same as the error going away, though —
// govuk-frontend's CharacterCount deliberately never removes a server-
// rendered .govuk-error-message it finds on the page (it reads it once, in
// its constructor, purely to decide whether to also toggle error styling on
// the textarea itself, and never touches it again). So without more, an
// operator who reduces back under the limit sees the live count correctly
// say "0 characters remaining" right next to a static error paragraph still
// insisting the field is too long — which is the bug reported after this
// first shipped. `data-error-type="length"` on that paragraph (only for the
// tooLong case, never for the unrelated "required" error below, which
// shares this same slot but isn't fixed by typing up to the limit) is what
// lets application.js's initCharacterCountLiveErrorClearing find and clear
// it once the operator is back within the limit — finishing what the
// component's own JS deliberately leaves undone.
export function buildTextareaInputs(payload, errors, t, application, readOnly) {
  const fields = application
    ? DETAIL_FIELDS.filter((field) => {
        const category = DETAIL_FIELD_TO_CATEGORY[field]
        const item = findBpItem(application.businessPlan, category)
        return (item.percentSpent ?? 0) > 0
      })
    : DETAIL_FIELDS

  return fields.map((field) => ({
    id: field,
    name: field,
    value: normaliseNewlines(payload[field]),
    label: { text: t(`pages.businessPlanDetail.fields.${field}`) },
    hint: { text: t('pages.businessPlanDetail.characterCountHint') },
    maxlength: MAX_CHARS,
    disabled: readOnly || undefined,
    errorMessage: errors[field]
      ? {
          text: errors[field].text,
          attributes: {
            'data-testid': `field-error-${field}`,
            ...(errors[field].tooLong ? { 'data-error-type': 'length' } : {})
          }
        }
      : undefined,
    attributes: { 'data-testid': `textarea-${field}` },
    formGroup: { attributes: { 'data-testid': `field-group-${field}` } }
  }))
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function businessPlanUrl(applicationId) {
  return `/accreditation/business-plan/${applicationId}`
}

function businessPlanCyaUrl(applicationId) {
  return `/accreditation/business-plan-cya/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/business-plan-detail/index', viewData)
}

function buildViewData(
  t,
  applicationId,
  payload,
  errors,
  application,
  readOnly = false,
  isQueriedApplication = false
) {
  const isExporter = application?.isExporter ?? false
  return {
    pageTitle: isExporter
      ? t('pages.businessPlanDetail.titleExporter')
      : t('pages.businessPlanDetail.title'),
    heading: isExporter
      ? t('pages.businessPlanDetail.headingExporter')
      : t('pages.businessPlanDetail.heading'),
    intro: t('pages.businessPlanDetail.intro'),
    backLink: businessPlanUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    textareaInputs: buildTextareaInputs(
      payload,
      errors,
      t,
      application,
      readOnly
    ),
    errors,
    readOnly,
    isQueriedApplication
  }
}

function payloadFromApplication(application) {
  const payload = {}
  for (const field of DETAIL_FIELDS) {
    const item = findBpItem(
      application.businessPlan,
      DETAIL_FIELD_TO_CATEGORY[field]
    )
    payload[field] = item.detailedDescription ?? ''
  }
  return payload
}

export const businessPlanDetailGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(h, {
          ...buildViewData(t, applicationId, {}, {}),
          error: t('pages.businessPlanDetail.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.businessPlan?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        payloadFromApplication(application),
        {},
        application,
        readOnly,
        application.applicationStatus === 'Queried'
      )
    )
  }
}

// Extracted from businessPlanDetailPostController (SonarCloud cyclomatic
// complexity): the 409/5xx/other three-way error response was inlined in
// the handler's catch block.
function handleBusinessPlanDetailSaveError({
  h,
  request,
  t,
  err,
  applicationId,
  fieldPayload,
  application
}) {
  logStructuredError(
    request.server.logger,
    err,
    { applicationId },
    `Error saving business plan detail ${applicationId}`
  )
  // RA-481: a 409 means the application locked between the guard check
  // above and this write landing — send the operator back to this page
  // so it re-fetches and renders read-only.
  if (err.status === statusCodes.conflict) {
    return h.redirect(request.path)
  }
  if (!err.status || err.status >= 500) {
    return h
      .view('errors/service-problem', {
        pageTitle: t('common.errors.serviceTitle'),
        retryUrl: request.path
      })
      .code(500)
  }
  return renderPage(h, {
    ...buildViewData(t, applicationId, fieldPayload, {}, application),
    error: t('pages.businessPlanDetail.validation.saveError')
  }).code(400)
}

export const businessPlanDetailPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction = 'saveAndContinue', ...fieldPayload } =
      request.payload

    const isSaveAndComeLater = submitAction === 'saveAndComeLater'

    // Always attempted (even for saveAndComeLater, which the previous
    // percentage-validation-only fetch skipped) so the RA-481 lock guard
    // below applies to every write path. Fails open on error, same as
    // before — the backend's own write-side guard is the real boundary.
    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch {
      // If fetch fails, skip percentage-based validation and the lock guard
    }

    if (application) {
      const guardRedirect = guardSectionWrite({
        h,
        application,
        sectionStatus: application.businessPlan?.sectionStatus,
        applicationId,
        ownPageUrl: request.path
      })
      if (guardRedirect) {
        return guardRedirect
      }
    }

    const errors = validateDetailFields(
      fieldPayload,
      t,
      isSaveAndComeLater ? null : application
    )

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, errors, application)
      }).code(400)
    }

    const patchBody = {}
    for (const field of DETAIL_FIELDS) {
      patchBody[field] = normaliseNewlines(fieldPayload[field])
    }
    if (isSaveAndComeLater) {
      patchBody.sectionStatus = 'InProgress'
    }

    try {
      await accreditationApiService.patchBusinessPlan(
        organisationId,
        applicationId,
        patchBody
      )
    } catch (err) {
      return handleBusinessPlanDetailSaveError({
        h,
        request,
        t,
        err,
        applicationId,
        fieldPayload,
        application
      })
    }

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(businessPlanCyaUrl(applicationId))
  }
}
