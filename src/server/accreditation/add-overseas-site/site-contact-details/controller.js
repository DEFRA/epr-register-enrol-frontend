import Joi from 'joi'
import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/
// RA-468: the contact is a person's name, not a reference/account number —
// reject any digit rather than allow-listing characters, so accented
// letters, apostrophes (O'Brien) and hyphens (Anne-Marie) keep working.
const NAME_CONTAINS_DIGIT_REGEX = /\d/
// RA-468: digits, a leading/embedded "+" and the spacing/grouping
// punctuation real international numbers are written with (this field asks
// for one via autocomplete="tel", e.g. "+49 40 12345678") — no letters or
// other text. The field itself stays optional; this only fires once
// something has been entered.
const PHONE_REGEX = /^[0-9+()\-\s]*$/

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

// RA-468: sequential early returns rather than if/else-if, matching
// site-location's validateCoordinates — keeps each field's rule count
// growable without the branch nesting Sonar's complexity/S126 rules flag,
// and keeps the POST handler itself a plain sequence of field checks.
function validateName(t, name) {
  if (!name) {
    return t('pages.addOverseasSite.siteContactDetails.validation.nameRequired')
  }
  if (NAME_CONTAINS_DIGIT_REGEX.test(name)) {
    return t('pages.addOverseasSite.siteContactDetails.validation.nameInvalid')
  }
  return null
}

function validateEmail(t, email) {
  if (!email) {
    return t(
      'pages.addOverseasSite.siteContactDetails.validation.emailRequired'
    )
  }
  if (!EMAIL_REGEX.test(email)) {
    return t('pages.addOverseasSite.siteContactDetails.validation.emailInvalid')
  }
  return null
}

function validatePhone(t, phone) {
  if (phone && !PHONE_REGEX.test(phone)) {
    return t('pages.addOverseasSite.siteContactDetails.validation.phoneInvalid')
  }
  return null
}

function validateContactDetailsFields(t, fields) {
  const errors = {}
  const nameError = validateName(t, fields.siteContactName)
  if (nameError) {
    errors.siteContactName = nameError
  }
  const emailError = validateEmail(t, fields.siteContactEmail)
  if (emailError) {
    errors.siteContactEmail = emailError
  }
  const phoneError = validatePhone(t, fields.siteContactPhone)
  if (phoneError) {
    errors.siteContactPhone = phoneError
  }
  return errors
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
    const fields = {
      siteContactName: session.siteContactName ?? '',
      siteContactEmail: session.siteContactEmail ?? '',
      siteContactPhone: session.siteContactPhone ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addOrsSiteContactDetailsPostController = {
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

    const fields = {
      siteContactName: (request.payload?.siteContactName ?? '').trim(),
      siteContactEmail: (request.payload?.siteContactEmail ?? '').trim(),
      siteContactPhone: (request.payload?.siteContactPhone ?? '').trim()
    }
    const errors = validateContactDetailsFields(t, fields)

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
