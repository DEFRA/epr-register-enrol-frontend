import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const CODES_BY_MATERIAL_TYPE = {
  Aluminium: ['R4', 'R12', 'R13'],
  Fibre: ['R3', 'R5', 'R12', 'R13'],
  Glass: ['R5', 'R12', 'R13'],
  Paper: ['R3', 'R12', 'R13'],
  Plastic: ['R3', 'R12', 'R13'],
  Steel: ['R4', 'R12', 'R13'],
  Wood: ['R3', 'R12', 'R13']
}

const ALL_CODES = ['R3', 'R4', 'R5', 'R12', 'R13']
const CODES_REQUIRING_ACCOMPANIMENT = new Set(['R12', 'R13'])

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-contact-details`
}

function baselCodeUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/recycling-operation-details/index',
    viewData
  )
}

function applicableCodesForMaterialType(materialType) {
  // Falls back to the full set when materialType is missing/unrecognised
  // (shouldn't happen in the real journey) rather than showing no options at all.
  return CODES_BY_MATERIAL_TYPE[materialType] ?? ALL_CODES
}

function buildOptions(t, applicableCodes, selectedCodes) {
  return applicableCodes.map((code) => ({
    value: code,
    text: t(
      `pages.addOverseasSite.recyclingOperationDetails.operations.${code}`
    ),
    checked: selectedCodes.includes(code)
  }))
}

function buildViewData(
  t,
  applicationId,
  applicableCodes,
  selectedCodes,
  error
) {
  return {
    pageTitle: t('pages.addOverseasSite.recyclingOperationDetails.title'),
    heading: t('pages.addOverseasSite.recyclingOperationDetails.heading'),
    label: t('pages.addOverseasSite.recyclingOperationDetails.label'),
    continueButton: t(
      'pages.addOverseasSite.recyclingOperationDetails.continueButton'
    ),
    cancelLink: t('pages.addOverseasSite.recyclingOperationDetails.cancelLink'),
    backLink: siteContactDetailsUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    options: buildOptions(t, applicableCodes, selectedCodes),
    error
  }
}

function normaliseCodes(raw) {
  const values = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function requiresAccompanyingCode(codes) {
  const hasR12OrR13 = codes.some((c) => CODES_REQUIRING_ACCOMPANIMENT.has(c))
  const hasOtherCode = codes.some((c) => !CODES_REQUIRING_ACCOMPANIMENT.has(c))
  return hasR12OrR13 && !hasOtherCode
}

export const addOrsRecyclingOperationGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const materialType = request.yar.get(
      ACCREDITATION_SESSION_KEYS.materialType
    )
    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        applicableCodesForMaterialType(materialType),
        session.recyclingOperationCodes ?? [],
        null
      )
    )
  }
}

export const addOrsRecyclingOperationPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const materialType = request.yar.get(
      ACCREDITATION_SESSION_KEYS.materialType
    )
    const applicableCodes = applicableCodesForMaterialType(materialType)
    const recyclingOperationCodes = normaliseCodes(
      request.payload?.recyclingOperationCodes
    )

    const renderError = (message) =>
      renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          applicableCodes,
          recyclingOperationCodes,
          message
        )
      ).code(400)

    if (
      recyclingOperationCodes.length === 0 ||
      !recyclingOperationCodes.every((code) => applicableCodes.includes(code))
    ) {
      return renderError(
        t('pages.addOverseasSite.recyclingOperationDetails.validation.required')
      )
    }

    if (requiresAccompanyingCode(recyclingOperationCodes)) {
      return renderError(
        t(
          'pages.addOverseasSite.recyclingOperationDetails.validation.accompanyingCodeRequired'
        )
      )
    }

    setAddOrsSession(request, { recyclingOperationCodes })
    return h.redirect(baselCodeUrl(applicationId))
  }
}
