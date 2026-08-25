import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import { resolveQueriedSectionAccess } from '../../common/helpers/queriedSectionAccess.js'
import {
  findBpItem,
  PERCENT_FIELD_TO_CATEGORY,
  DETAIL_FIELD_TO_CATEGORY
} from '../business-plan/helpers.js'
import {
  BUSINESS_PLAN_PERCENT_FIELDS,
  BUSINESS_PLAN_DETAIL_FIELDS
} from '../../common/constants/businessPlanCategories.js'

// RA-456: derived from the shared category map — see
// common/constants/businessPlanCategories.js
const PERCENT_FIELDS = BUSINESS_PLAN_PERCENT_FIELDS

const DETAIL_FIELDS = BUSINESS_PLAN_DETAIL_FIELDS

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

function headingViewData(t, application) {
  const isExporter = application?.isExporter ?? false
  return {
    pageTitle: t('pages.businessPlanCya.title'),
    heading: t('pages.businessPlanCya.heading'),
    subHeading: isExporter
      ? t('pages.businessPlanCya.subHeadingExporter')
      : t('pages.businessPlanCya.subHeading')
  }
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
        ...headingViewData(t, application),
        backLink: taskListUrl(applicationId),
        error: t('pages.businessPlanCya.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.businessPlan?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const { percentRows, detailRows } = buildSummaryRows(
      application,
      t,
      applicationId
    )

    return renderPage(h, {
      ...headingViewData(t, application),
      percentRows,
      detailRows,
      backLink: taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId),
      readOnly,
      isQueriedApplication: application.applicationStatus === 'Queried'
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
        ...headingViewData(t, application),
        backLink: taskListUrl(applicationId),
        error: t('pages.businessPlanCya.validation.fetchError')
      }).code(500)
    }

    {
      const { blocked, readOnly } = resolveQueriedSectionAccess(
        application,
        application.businessPlan?.sectionStatus
      )
      if (
        blocked ||
        (readOnly && application.applicationStatus === 'Queried')
      ) {
        return h.redirect(queryTaskListUrl(applicationId))
      }
      if (readOnly) {
        return h.redirect(request.path)
      }
    }

    const bp = application.businessPlan
    const patchBody = { sectionStatus: 'Completed' }
    for (const field of PERCENT_FIELDS) {
      const category = PERCENT_FIELD_TO_CATEGORY[field]
      const item = findBpItem(bp, category)
      patchBody[field] = item.percentSpent ?? null
    }
    for (const field of DETAIL_FIELDS) {
      const category = DETAIL_FIELD_TO_CATEGORY[field]
      const item = findBpItem(bp, category)
      patchBody[field] = item.detailedDescription ?? ''
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
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to this page
      // so it re-fetches and renders read-only.
      if (err.status === 409) {
        return h.redirect(request.path)
      }
      const { percentRows, detailRows } = buildSummaryRows(
        application,
        t,
        applicationId
      )
      return renderPage(h, {
        ...headingViewData(t, application),
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
