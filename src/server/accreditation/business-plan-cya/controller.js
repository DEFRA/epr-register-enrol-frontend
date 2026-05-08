import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

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

const API_PERCENT_MAP = {
  newInfrastructurePercent: 'NewInfrastructurePercent',
  priceSupportPercent: 'PriceSupportPercent',
  businessCollectionsPercent: 'BusinessCollectionsPercent',
  communicationsPercent: 'CommunicationsPercent',
  newMarketsPercent: 'NewMarketsPercent',
  newUsesPercent: 'NewUsesPercent'
}

const API_DETAIL_MAP = {
  newInfrastructureDetail: 'NewInfrastructureDetail',
  priceSupportDetail: 'PriceSupportDetail',
  businessCollectionsDetail: 'BusinessCollectionsDetail',
  communicationsDetail: 'CommunicationsDetail',
  newMarketsDetail: 'NewMarketsDetail',
  newUsesDetail: 'NewUsesDetail'
}

export function buildSummaryRows(application, t, applicationId) {
  const bp = application.BusinessPlan ?? {}
  const fromCYA = '?fromCYA=true'
  const percentUrl = `/accreditation/business-plan/${applicationId}${fromCYA}`
  const detailUrl = `/accreditation/business-plan-detail/${applicationId}${fromCYA}`

  const percentRows = PERCENT_FIELDS.map((field) => {
    const apiField = API_PERCENT_MAP[field]
    const value =
      bp[apiField] !== undefined
        ? `${bp[apiField]}%`
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
    const apiField = API_DETAIL_MAP[field]
    const value = bp[apiField] || t('pages.businessPlanCya.notProvided')
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
    const user = getUser(request)
    const organisationId = user?.id
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
    const user = getUser(request)
    const organisationId = user?.id
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

    const bp = application.BusinessPlan ?? {}
    const patchBody = { SectionStatus: 'Completed' }
    for (const field of PERCENT_FIELDS) {
      patchBody[API_PERCENT_MAP[field]] = bp[API_PERCENT_MAP[field]] ?? null
    }
    for (const field of DETAIL_FIELDS) {
      patchBody[API_DETAIL_MAP[field]] = bp[API_DETAIL_MAP[field]] ?? ''
    }

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
