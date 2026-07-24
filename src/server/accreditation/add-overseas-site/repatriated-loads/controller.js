import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const STEEL_ALU_MATERIALS = new Set(['Steel', 'Aluminium'])

export function requiresConditionsOfExport(materialType) {
  return STEEL_ALU_MATERIALS.has(materialType)
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function baselCodeUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
}

function conditionsOfExportUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/conditions-of-export`
}

function cyaUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/check-your-answers`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/repatriated-loads/index',
    viewData
  )
}

function buildViewData(t, applicationId, repatriatedLoads, error) {
  return {
    pageTitle: t('pages.addOverseasSite.repatriatedLoads.title'),
    heading: t('pages.addOverseasSite.repatriatedLoads.heading'),
    label: t('pages.addOverseasSite.repatriatedLoads.label'),
    hint: t('pages.addOverseasSite.repatriatedLoads.hint'),
    maxWords: t('pages.addOverseasSite.repatriatedLoads.maxWords'),
    continueButton: t('pages.addOverseasSite.repatriatedLoads.continueButton'),
    cancelLink: t('pages.addOverseasSite.repatriatedLoads.cancelLink'),
    backLink: baselCodeUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    repatriatedLoads,
    error
  }
}

export const addOrsRepatriatedLoadsGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    return renderPage(
      h,
      buildViewData(t, applicationId, session.repatriatedLoads ?? '', null)
    )
  }
}

export const addOrsRepatriatedLoadsPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const repatriatedLoads = (request.payload?.repatriatedLoads ?? '').trim()

    if (!repatriatedLoads) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          '',
          t('pages.addOverseasSite.repatriatedLoads.validation.required')
        )
      ).code(400)
    }

    const wordCount = countWords(repatriatedLoads)
    if (wordCount > 500) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          repatriatedLoads,
          t('pages.addOverseasSite.repatriatedLoads.validation.tooManyWords')
        )
      ).code(400)
    }

    setAddOrsSession(request, { repatriatedLoads })

    const materialType = request.yar.get(
      ACCREDITATION_SESSION_KEYS.materialType
    )
    const nextUrl = STEEL_ALU_MATERIALS.has(materialType)
      ? conditionsOfExportUrl(applicationId)
      : cyaUrl(applicationId)

    return h.redirect(nextUrl)
  }
}
