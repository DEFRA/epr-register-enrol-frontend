import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { apiClient } from '../../common/api-client.js'

export const BUSINESS_PLAN_FIELDS = [
  'newInfrastructurePercent',
  'priceSupportPercent',
  'businessCollectionsPercent',
  'communicationsPercent',
  'newMarketsPercent',
  'newUsesPercent'
]

const API_FIELD_MAP = {
  newInfrastructurePercent: 'NewInfrastructurePercent',
  priceSupportPercent: 'PriceSupportPercent',
  businessCollectionsPercent: 'BusinessCollectionsPercent',
  communicationsPercent: 'CommunicationsPercent',
  newMarketsPercent: 'NewMarketsPercent',
  newUsesPercent: 'NewUsesPercent'
}

export function parsePercent(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null
  }
  const trimmed = String(value).trim()
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

function appUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}`
}

function patchUrl(organisationId, applicationId) {
  return `/api/v1/accreditation-applications/${organisationId}/${applicationId}/business-plan`
}

function renderPage(h, viewData) {
  return h.view('accreditation/business-plan/index', viewData)
}

function buildViewData(t, applicationId, payload, errors) {
  return {
    pageTitle: t('pages.businessPlan.title'),
    heading: t('pages.businessPlan.heading'),
    intro: t('pages.businessPlan.intro'),
    backLink: taskListUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    fieldInputs: buildFieldInputs(payload, errors, t),
    errors,
    sumError: errors._sum
  }
}

function payloadFromApplication(application) {
  const bp = application.BusinessPlan ?? {}
  const payload = {}
  for (const field of BUSINESS_PLAN_FIELDS) {
    const apiField = API_FIELD_MAP[field]
    payload[field] = bp[apiField] !== undefined ? String(bp[apiField]) : ''
  }
  return payload
}

export const businessPlanGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params

    let application
    try {
      application = await apiClient.get(appUrl(organisationId, applicationId))
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, {}, {}),
        error: t('pages.businessPlan.validation.fetchError')
      }).code(500)
    }

    return renderPage(
      h,
      buildViewData(t, applicationId, payloadFromApplication(application), {})
    )
  }
}

export const businessPlanPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
    const { applicationId } = request.params
    const { submitAction = 'saveAndContinue', ...fieldPayload } =
      request.payload

    const isSaveAndComeLater = submitAction === 'saveAndComeLater'
    const { errors, values } = validateBusinessPlanFields(
      fieldPayload,
      t,
      isSaveAndComeLater
    )

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, errors)
      }).code(400)
    }

    const patchBody = {}
    for (const field of BUSINESS_PLAN_FIELDS) {
      patchBody[API_FIELD_MAP[field]] = values[field] ?? null
    }

    try {
      await apiClient.patch(patchUrl(organisationId, applicationId), patchBody)
    } catch (err) {
      request.server.logger.error(
        `Error saving business plan for ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, {}),
        error: t('pages.businessPlan.validation.saveError')
      }).code(500)
    }

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(businessPlanDetailUrl(applicationId))
  }
}
