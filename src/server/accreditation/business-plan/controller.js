import Joi from 'joi'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import { findBpItem, PERCENT_FIELD_TO_CATEGORY } from './helpers.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { BUSINESS_PLAN_PERCENT_FIELDS } from '../../common/constants/businessPlanCategories.js'

// RA-456: derived from the shared category map — see
// common/constants/businessPlanCategories.js
export const BUSINESS_PLAN_FIELDS = BUSINESS_PLAN_PERCENT_FIELDS

// Shape/size only, not business validity: validateBusinessPlanFields already
// renders its own friendly inline errors for a missing/non-numeric percent
// (M1, 2026-08-08 pentest report — Joi's job is blocking payloads the
// controller was never built to handle, e.g. arrays/objects instead of a
// scalar). .unknown(true) lets the CSRF crumb field through.
export const businessPlanPayloadSchema = Joi.object({
  submitAction: Joi.string().max(50).optional(),
  ...Object.fromEntries(
    BUSINESS_PLAN_FIELDS.map((field) => [
      field,
      Joi.string().allow('').max(20).optional()
    ])
  )
}).unknown(true)

export function parsePercent(value) {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = String(value).trim()
  if (trimmed === '') {
    return 0
  }
  if (!/^\d+$/.test(trimmed)) {
    return Number.NaN
  }
  return Number.parseInt(trimmed, 10)
}

export function validateBusinessPlanFields(payload, t, skipSumCheck = false) {
  const errors = {}
  const values = {}

  for (const field of BUSINESS_PLAN_FIELDS) {
    const raw = payload[field]
    const label = t(`pages.businessPlan.fields.${field}`)
    const parsed = parsePercent(raw)

    if (parsed === null) {
      if (!skipSumCheck) {
        errors[field] = {
          text: t('pages.businessPlan.validation.wholeNumber').replace(
            '{field}',
            label
          )
        }
      }
    } else if (Number.isNaN(parsed)) {
      errors[field] = {
        text: t('pages.businessPlan.validation.wholeNumber').replace(
          '{field}',
          label
        )
      }
    } else if (parsed < 0 || parsed > 100) {
      errors[field] = {
        text: t('pages.businessPlan.validation.outOfRange').replace(
          '{field}',
          label
        )
      }
    } else {
      values[field] = parsed
    }
  }

  if (!skipSumCheck && Object.keys(errors).length === 0) {
    const sum = BUSINESS_PLAN_FIELDS.reduce(
      (acc, f) => acc + (values[f] ?? 0),
      0
    )
    if (sum !== 100) {
      errors._sum = { text: t('pages.businessPlan.validation.mustSumTo100') }
    }
  }

  return { errors, values }
}

export function buildFieldInputs(payload, errors, t) {
  return BUSINESS_PLAN_FIELDS.map((field) => ({
    id: field,
    name: field,
    value: payload[field] ?? '',
    label: t(`pages.businessPlan.fields.${field}`),
    errorMessage: errors[field] ? { text: errors[field].text } : undefined
  }))
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function businessPlanDetailUrl(applicationId) {
  return `/accreditation/business-plan-detail/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/business-plan/index', viewData)
}

function buildViewData(
  t,
  applicationId,
  payload,
  errors,
  isExporter = false,
  queryNote = null,
  querySummary = null,
  regulatorQueryFields = null,
  readOnly = false,
  isQueriedApplication = false
) {
  return {
    pageTitle: t('pages.businessPlan.title'),
    heading: t('pages.businessPlan.heading'),
    intro: isExporter
      ? t('pages.businessPlan.introExporter')
      : t('pages.businessPlan.intro'),
    // RA-481: only route back to the query task list while the application
    // itself is mid-query — a locked-but-not-queried application is
    // read-only for a different reason and belongs back on the ordinary
    // task list, which renders read-only in that case too.
    backLink: isQueriedApplication
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    fieldInputs: buildFieldInputs(payload, errors, t),
    errors,
    sumError: errors._sum,
    queryNote,
    querySummary,
    regulatorQueryFields,
    readOnly,
    isQueriedApplication
  }
}

// Split out of businessPlanPostController.handler to keep its cyclomatic
// complexity/line count under SonarCloud's per-function thresholds.
function buildBusinessPlanPatchBody(values, isSaveAndComeLater) {
  const patchBody = { isPartialSave: true }
  for (const field of BUSINESS_PLAN_FIELDS) {
    patchBody[field] = values[field] ?? null
  }
  if (isSaveAndComeLater) {
    patchBody.sectionStatus = 'InProgress'
  }
  return patchBody
}

function payloadFromApplication(application) {
  const payload = {}
  for (const field of BUSINESS_PLAN_FIELDS) {
    const item = findBpItem(
      application.businessPlan,
      PERCENT_FIELD_TO_CATEGORY[field]
    )
    payload[field] =
      item.percentSpent !== undefined ? String(item.percentSpent) : ''
  }
  return payload
}

export const businessPlanGetController = {
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
        { applicationId, err },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, {}, {}),
        error: t('pages.businessPlan.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.businessPlan?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const isExporter = application.isExporter ?? false
    const queryNote = resolveRegulatorQueryNote(application, { readOnly })

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        payloadFromApplication(application),
        {},
        isExporter,
        queryNote,
        queryNote ? buildRegulatorQuerySummary('businessPlan', t) : null,
        queryNote
          ? [
              {
                label: t('pages.taskList.tasks.businessPlan'),
                href: '#newInfrastructurePercent'
              }
            ]
          : null,
        readOnly,
        application.applicationStatus === 'Queried'
      )
    )
  }
}

// Extracted from businessPlanPostController (SonarCloud cyclomatic
// complexity): the 409/5xx/other three-way error response was inlined in
// the handler's catch block.
function handleBusinessPlanSaveError({
  h,
  request,
  t,
  err,
  applicationId,
  fieldPayload,
  isExporter
}) {
  request.server.logger.error(
    { applicationId, err },
    `Error saving business plan ${applicationId}`
  )
  // RA-481: the guard above already checked read/write access before this
  // patch was sent, but a 409 here means the application locked (e.g. was
  // submitted) in the gap between that check and this request landing —
  // send the operator to the section's own page so it re-fetches and
  // renders read-only, rather than a raw error.
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
    ...buildViewData(t, applicationId, fieldPayload, {}, isExporter),
    error: t('pages.businessPlan.validation.saveError')
  }).code(400)
}

export const businessPlanPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction = 'saveAndContinue', ...fieldPayload } =
      request.payload

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        { applicationId, err },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, {}),
        error: t('pages.businessPlan.validation.fetchError')
      }).code(500)
    }

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

    const isExporter = application.isExporter ?? false

    const isSaveAndComeLater = submitAction === 'saveAndComeLater'
    const { errors, values } = validateBusinessPlanFields(
      fieldPayload,
      t,
      isSaveAndComeLater
    )

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, errors, isExporter)
      }).code(400)
    }

    const patchBody = buildBusinessPlanPatchBody(values, isSaveAndComeLater)

    try {
      await accreditationApiService.patchBusinessPlan(
        organisationId,
        applicationId,
        patchBody
      )
    } catch (err) {
      return handleBusinessPlanSaveError({
        h,
        request,
        t,
        err,
        applicationId,
        fieldPayload,
        isExporter
      })
    }

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(businessPlanDetailUrl(applicationId))
  }
}
