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
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

// RA-456: derived from the shared category map — see
// common/constants/businessPlanCategories.js
export const DETAIL_FIELDS = BUSINESS_PLAN_DETAIL_FIELDS

const MAX_CHARS = 500

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

    const value = payload[field] ?? ''
    if (value.length > MAX_CHARS) {
      const label = t(`pages.businessPlanDetail.fields.${field}`)
      errors[field] = {
        text: t('pages.businessPlanDetail.validation.tooLong').replace(
          '{field}',
          label
        )
      }
    } else if (application && !value.trim()) {
      errors[field] = {
        text: t('pages.businessPlanDetail.validation.requiredWhenPercent')
      }
    }
  }

  return errors
}

export function buildTextareaInputs(payload, errors, t, application) {
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
    value: payload[field] ?? '',
    label: t(`pages.businessPlanDetail.fields.${field}`),
    hint: t('pages.businessPlanDetail.characterCountHint'),
    maxlength: MAX_CHARS,
    errorMessage: errors[field] ? { text: errors[field].text } : undefined
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
    textareaInputs: buildTextareaInputs(payload, errors, t, application),
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
  logControllerError(
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
      patchBody[field] = fieldPayload[field] ?? ''
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
