import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  extractSiteContactFields,
  validateSiteContactDetails
} from '../../../common/helpers/siteContactDetails.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

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

// Unlike the ORS page, the phone is required here and the name isn't checked
// for digits.
const CONTACT_VALIDATION_OPTIONS = {
  keyPrefix: 'pages.addInterimSite.siteContactDetails.validation',
  phoneRequired: true,
  nameRejectsDigits: false
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

    const fields = extractSiteContactFields(request.payload)
    const errors = validateSiteContactDetails(
      t,
      fields,
      CONTACT_VALIDATION_OPTIONS
    )

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
