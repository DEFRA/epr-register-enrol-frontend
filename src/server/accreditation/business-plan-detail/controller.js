import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

export const DETAIL_FIELDS = [
  'newInfrastructureDetail',
  'priceSupportDetail',
  'businessCollectionsDetail',
  'communicationsDetail',
  'newMarketsDetail',
  'newUsesDetail'
]

const MAX_CHARS = 500

export function validateDetailFields(payload, t) {
  const errors = {}

  for (const field of DETAIL_FIELDS) {
    const value = payload[field] ?? ''
    if (value.length > MAX_CHARS) {
      const label = t(`pages.businessPlanDetail.fields.${field}`)
      errors[field] = {
        text: t('pages.businessPlanDetail.validation.tooLong').replace(
          '{field}',
          label
        )
      }
    }
  }

  return errors
}

export function buildTextareaInputs(payload, errors, t) {
  return DETAIL_FIELDS.map((field) => ({
    id: field,
    name: field,
    value: payload[field] ?? '',
    label: `${t(`pages.businessPlanDetail.fields.${field}`)} ${t('pages.businessPlanDetail.optional')}`,
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

function buildViewData(t, applicationId, payload, errors) {
  return {
    pageTitle: t('pages.businessPlanDetail.title'),
    heading: t('pages.businessPlanDetail.heading'),
    intro: t('pages.businessPlanDetail.intro'),
    backLink: businessPlanUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    textareaInputs: buildTextareaInputs(payload, errors, t),
    errors
  }
}

function payloadFromApplication(application) {
  const bp = application.businessPlan ?? {}
  const payload = {}
  for (const field of DETAIL_FIELDS) {
    payload[field] = bp[field] ?? ''
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
        error: t('pages.businessPlanDetail.validation.fetchError')
      }).code(500)
    }

    return renderPage(
      h,
      buildViewData(t, applicationId, payloadFromApplication(application), {})
    )
  }
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
    const errors = validateDetailFields(fieldPayload, t)

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, fieldPayload, errors)
      }).code(400)
    }

    const patchBody = {}
    for (const field of DETAIL_FIELDS) {
      patchBody[field] = fieldPayload[field] ?? ''
    }

    try {
      await accreditationApiService.patchBusinessPlan(
        organisationId,
        applicationId,
        patchBody
      )
    } catch (err) {
      request.server.logger.error(
        `Error saving business plan detail for ${applicationId}: ${err.message}`
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
        ...buildViewData(t, applicationId, fieldPayload, {}),
        error: t('pages.businessPlanDetail.validation.saveError')
      }).code(400)
    }

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(businessPlanCyaUrl(applicationId))
  }
}
