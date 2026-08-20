import Joi from 'joi'
import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Type/size only, not "is this valid": the handler renders its own friendly
// inline errors for missing/malformed values already. Without this, a
// non-string field (e.g. an array) crashes `.trim()` above with an
// unhandled exception rather than a graceful error (M1, 2026-08-08 pentest
// report). .unknown(true) lets the CSRF crumb field through.
export const siteContactDetailsPayloadSchema = Joi.object({
  siteContactName: Joi.string().allow('').max(200).optional(),
  siteContactEmail: Joi.string().allow('').max(320).optional(),
  siteContactPhone: Joi.string().allow('').max(50).optional()
}).unknown(true)

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-location`
}

function recyclingOperationDetailsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/recycling-operation-details`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/site-contact-details/index',
    viewData
  )
}

function buildViewData(t, applicationId, fields, errors) {
  return {
    pageTitle: t('pages.addOverseasSite.siteContactDetails.title'),
    heading: t('pages.addOverseasSite.siteContactDetails.heading'),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    backLink: siteLocationUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    fields,
    errors
  }
}

export const addOrsSiteContactDetailsGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const fields = {
      siteContactName: session.siteContactName ?? '',
      siteContactEmail: session.siteContactEmail ?? '',
      siteContactPhone: session.siteContactPhone ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addOrsSiteContactDetailsPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const fields = {
      siteContactName: (request.payload?.siteContactName ?? '').trim(),
      siteContactEmail: (request.payload?.siteContactEmail ?? '').trim(),
      siteContactPhone: (request.payload?.siteContactPhone ?? '').trim()
    }
    const errors = {}

    if (!fields.siteContactName) {
      errors.siteContactName = t(
        'pages.addOverseasSite.siteContactDetails.validation.nameRequired'
      )
    }
    if (!fields.siteContactEmail) {
      errors.siteContactEmail = t(
        'pages.addOverseasSite.siteContactDetails.validation.emailRequired'
      )
    } else if (!EMAIL_REGEX.test(fields.siteContactEmail)) {
      errors.siteContactEmail = t(
        'pages.addOverseasSite.siteContactDetails.validation.emailInvalid'
      )
    }

    if (Object.keys(errors).length > 0) {
      return renderPage(
        h,
        buildViewData(t, applicationId, fields, errors)
      ).code(400)
    }

    setAddOrsSession(request, fields)
    return h.redirect(recyclingOperationDetailsUrl(applicationId))
  }
}
