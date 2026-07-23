import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const CODE_REGEX = /^(?:[A-Za-z]\d{4}|[A-Za-z]{2}\d{3})$/

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function recyclingOperationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/recycling-operation-details`
}

function repatriatedLoadsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/repatriated-loads`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/basel-convention-and-oecd-code/index',
    viewData
  )
}

function buildViewData(t, applicationId, fields, errors) {
  return {
    pageTitle: t('pages.addOverseasSite.baselAndOecdCodes.title'),
    heading: t('pages.addOverseasSite.baselAndOecdCodes.heading'),
    code1Label: t('pages.addOverseasSite.baselAndOecdCodes.code1Label'),
    code2Label: t('pages.addOverseasSite.baselAndOecdCodes.code2Label'),
    code3Label: t('pages.addOverseasSite.baselAndOecdCodes.code3Label'),
    hint: t('pages.addOverseasSite.baselAndOecdCodes.hint'),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    backLink: recyclingOperationUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    fields,
    errors
  }
}

export const addOrsBaselCodeGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const fields = {
      baselConventionCode1: session.baselConventionCode1 ?? '',
      baselConventionCode2: session.baselConventionCode2 ?? '',
      baselConventionCode3: session.baselConventionCode3 ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addOrsBaselCodePostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const fields = {
      baselConventionCode1: (request.payload?.baselConventionCode1 ?? '')
        .trim()
        .toUpperCase(),
      baselConventionCode2: (request.payload?.baselConventionCode2 ?? '')
        .trim()
        .toUpperCase(),
      baselConventionCode3: (request.payload?.baselConventionCode3 ?? '')
        .trim()
        .toUpperCase()
    }
    const errors = {}

    if (!fields.baselConventionCode1) {
      errors.baselConventionCode1 = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.code1Required'
      )
    } else if (!CODE_REGEX.test(fields.baselConventionCode1)) {
      errors.baselConventionCode1 = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.codeInvalid'
      )
    }

    if (
      fields.baselConventionCode2 &&
      !CODE_REGEX.test(fields.baselConventionCode2)
    ) {
      errors.baselConventionCode2 = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.codeInvalid'
      )
    }

    if (
      fields.baselConventionCode3 &&
      !CODE_REGEX.test(fields.baselConventionCode3)
    ) {
      errors.baselConventionCode3 = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.codeInvalid'
      )
    }

    if (Object.keys(errors).length > 0) {
      return renderPage(
        h,
        buildViewData(t, applicationId, fields, errors)
      ).code(400)
    }

    setAddOrsSession(request, fields)
    return h.redirect(repatriatedLoadsUrl(applicationId))
  }
}
