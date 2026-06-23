import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { findBpItem, PERCENT_FIELD_TO_CATEGORY } from './helpers.js'

export const BUSINESS_PLAN_FIELDS = [
  'newInfrastructurePercent',
  'priceSupportPercent',
  'businessCollectionsPercent',
  'communicationsPercent',
  'newMarketsPercent',
  'newUsesPercent'
]

export function parsePercent(value) {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = String(value).trim()
  if (trimmed === '') {
    return 0
  }
  if (!/^\d+$/.test(trimmed)) {
    return NaN
  }
  return parseInt(trimmed, 10)
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
    } else if (isNaN(parsed)) {
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

function buildViewData(t, applicationId, payload, errors, isExporter = false) {
  return {
    pageTitle: t('pages.businessPlan.title'),
    heading: t('pages.businessPlan.heading'),
    intro: isExporter
      ? t('pages.businessPlan.introExporter')
      : t('pages.businessPlan.intro'),
    backLink: taskListUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    fieldInputs: buildFieldInputs(payload, errors, t),
    errors,
    sumError: errors._sum
  }
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
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, {}, {}),
        error: t('pages.businessPlan.validation.fetchError')
      }).code(500)
    }

    const isExporter = application.isExporter ?? false

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        payloadFromApplication(application),
        {},
        isExporter
      )
    )
  }
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
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, {}),
        error: t('pages.businessPlan.validation.fetchError')
      }).code(500)
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

    const patchBody = {
      items: BUSINESS_PLAN_FIELDS.map((field) => ({
        category: PERCENT_FIELD_TO_CATEGORY[field],
        percentSpent: values[field] ?? null
      }))
    }

    try {
      await accreditationApiService.patchBusinessPlan(
        organisationId,
        applicationId,
        patchBody
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving business plan for ${applicationId}: ${err.message}`
      )
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

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(businessPlanDetailUrl(applicationId))
  }
}
