import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  findBpItem,
  PERCENT_FIELD_TO_CATEGORY,
  DETAIL_FIELD_TO_CATEGORY
} from '../business-plan/helpers.js'

const PERCENT_FIELDS = [
  'newInfrastructurePercent',
  'priceSupportPercent',
  'businessCollectionsPercent',
  'communicationsPercent',
  'newMarketsPercent',
  'newUsesPercent'
]

const DETAIL_FIELDS = [
  'newInfrastructureDetail',
  'priceSupportDetail',
  'businessCollectionsDetail',
  'communicationsDetail',
  'newMarketsDetail',
  'newUsesDetail'
]

export function buildSummaryRows(application, t, applicationId) {
  const bp = application.businessPlan
  const fromCYA = '?fromCYA=true'
  const percentUrl = `/accreditation/business-plan/${applicationId}${fromCYA}`
  const detailUrl = `/accreditation/business-plan-detail/${applicationId}${fromCYA}`

  const percentRows = PERCENT_FIELDS.map((field) => {
    const item = findBpItem(bp, PERCENT_FIELD_TO_CATEGORY[field])
    const value =
      item.percentSpent !== undefined
        ? `${item.percentSpent}%`
        : t('pages.businessPlanCya.notProvided')
    const label = t(`pages.businessPlanCya.fields.${field}`)
    return {
      id: field,
      label,
      value,
      changeLink: percentUrl,
      changeContext: t('pages.businessPlanCya.changePercentContext').replace(
        '{field}',
        label
      )
    }
  })

  const detailRows = DETAIL_FIELDS.map((field) => {
    const item = findBpItem(bp, DETAIL_FIELD_TO_CATEGORY[field])
    const value =
      item.detailedDescription || t('pages.businessPlanCya.notProvided')
    const percentField = field.replace('Detail', 'Percent')
    const label = t(`pages.businessPlanCya.fields.${percentField}`)
    return {
      id: field,
      label,
      value,
      changeLink: detailUrl,
      changeContext: t('pages.businessPlanCya.changeDetailContext').replace(
        '{field}',
        label
      )
    }
  })

  return { percentRows, detailRows }
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/business-plan-cya/index', viewData)
}

export const businessPlanCyaGetController = {
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
        pageTitle: t('pages.businessPlanCya.title'),
        heading: t('pages.businessPlanCya.heading'),
        subHeading: t('pages.businessPlanCya.subHeading'),
        backLink: taskListUrl(applicationId),
        error: t('pages.businessPlanCya.validation.fetchError')
      }).code(500)
    }

    const { percentRows, detailRows } = buildSummaryRows(
      application,
      t,
      applicationId
    )

    return renderPage(h, {
      pageTitle: t('pages.businessPlanCya.title'),
      heading: t('pages.businessPlanCya.heading'),
      subHeading: t('pages.businessPlanCya.subHeading'),
      percentRows,
      detailRows,
      backLink: taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId)
    })
  }
}

export const businessPlanCyaPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction = 'confirm' } = request.payload

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

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
        pageTitle: t('pages.businessPlanCya.title'),
        heading: t('pages.businessPlanCya.heading'),
        subHeading: t('pages.businessPlanCya.subHeading'),
        backLink: taskListUrl(applicationId),
        error: t('pages.businessPlanCya.validation.fetchError')
      }).code(500)
    }

    const bp = application.businessPlan
    const items = PERCENT_FIELDS.map((field) => {
      const category = PERCENT_FIELD_TO_CATEGORY[field]
      const item = findBpItem(bp, category)
      return {
        category,
        percentSpent: item.percentSpent ?? null,
        detailedDescription: item.detailedDescription ?? ''
      }
    })
    const patchBody = { sectionStatus: 'Completed', items }

    try {
      await accreditationApiService.patchBusinessPlan(
        organisationId,
        applicationId,
        patchBody
      )
    } catch (err) {
      request.server.logger.error(
        `Error confirming business plan for ${applicationId}: ${err.message}`
      )
      const { percentRows, detailRows } = buildSummaryRows(
        application,
        t,
        applicationId
      )
      return renderPage(h, {
        pageTitle: t('pages.businessPlanCya.title'),
        heading: t('pages.businessPlanCya.heading'),
        subHeading: t('pages.businessPlanCya.subHeading'),
        percentRows,
        detailRows,
        backLink: taskListUrl(applicationId),
        taskListLink: taskListUrl(applicationId),
        error: t('pages.businessPlanCya.validation.confirmError')
      }).code(500)
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
