import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import { isValidPhoneNumber } from '../../../common/helpers/phoneNumber.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-location`
}

function recyclingOperationDetailsUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/recycling-operation-details`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-interim-site/site-contact-details/index',
    viewData
  )
}

const VALIDATION_KEY_PREFIX =
  'pages.addInterimSite.siteContactDetails.validation'

// Sequential early returns rather than if/else-if, matching the ORS contact
// page, so each field's rule count can grow without tripping Sonar's
// complexity (S1541) / missing-else (S126) rules on the POST handler.
function validateName(t, name) {
  if (!name) {
    return t(`${VALIDATION_KEY_PREFIX}.nameRequired`)
  }
  return null
}

function validateEmail(t, email) {
  if (!email) {
    return t(`${VALIDATION_KEY_PREFIX}.emailRequired`)
  }
  if (!EMAIL_REGEX.test(email)) {
    return t(`${VALIDATION_KEY_PREFIX}.emailInvalid`)
  }
  return null
}

function validatePhone(t, phone) {
  if (!phone) {
    return t(`${VALIDATION_KEY_PREFIX}.phoneRequired`)
  }
  if (!isValidPhoneNumber(phone)) {
    return t(`${VALIDATION_KEY_PREFIX}.phoneInvalid`)
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
    pageTitle: t('pages.addInterimSite.siteContactDetails.title'),
    heading: t('pages.addInterimSite.siteContactDetails.heading'),
    continueButton: t('pages.addInterimSite.siteName.continueButton'),
    cancelLink: t('pages.addInterimSite.siteName.cancelLink'),
    backLink: siteLocationUrl(applicationId),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    fields,
    errors
  }
}

export const addInterimSiteContactDetailsGetController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const { t, guardRedirect } = await enterInterimSiteWizardStep({
      request,
      h,
      applicationId
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const session = getAddInterimSiteSession(request)

    const linkedSiteGuardRedirect = guardInterimSiteLinkedSiteId({
      h,
      session,
      fallbackUrl: selectOverseasSitesUrl(applicationId)
    })
    if (linkedSiteGuardRedirect) {
      return linkedSiteGuardRedirect
    }

    const fields = {
      siteContactName: session.siteContactName ?? '',
      siteContactEmail: session.siteContactEmail ?? '',
      siteContactPhone: session.siteContactPhone ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addInterimSiteContactDetailsPostController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const { t, guardRedirect } = await enterInterimSiteWizardStep({
      request,
      h,
      applicationId
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

    setAddInterimSiteSession(request, fields)
    return h.redirect(recyclingOperationDetailsUrl(applicationId))
  }
}
