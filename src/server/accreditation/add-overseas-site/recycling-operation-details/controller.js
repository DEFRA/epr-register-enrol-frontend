import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import {
  applicableCodesForMaterialType,
  validateRecyclingOperationCodes
} from '../../../common/helpers/overseasSiteAnswerValidation.js'

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

export const addOrsRecyclingOperationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

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
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

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

    const error = validateRecyclingOperationCodes(
      t,
      recyclingOperationCodes,
      materialType
    )
    if (error) {
      return renderError(error)
    }

    setAddOrsSession(request, { recyclingOperationCodes })
    return h.redirect(baselCodeUrl(applicationId))
  }
}
