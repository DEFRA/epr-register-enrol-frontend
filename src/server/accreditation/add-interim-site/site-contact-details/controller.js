import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  guardOverseasSiteWizardEntry,
  guardInterimSiteLinkedSiteId
} from '../../../common/helpers/overseasSiteWizardGuard.js'
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
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOverseasSitesUrl(applicationId)
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
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOverseasSitesUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const fields = {
      siteContactName: (request.payload?.siteContactName ?? '').trim(),
      siteContactEmail: (request.payload?.siteContactEmail ?? '').trim(),
      siteContactPhone: (request.payload?.siteContactPhone ?? '').trim()
    }
    const errors = {}

    if (!fields.siteContactName) {
      errors.siteContactName = t(
        'pages.addInterimSite.siteContactDetails.validation.nameRequired'
      )
    }
    if (!fields.siteContactEmail) {
      errors.siteContactEmail = t(
        'pages.addInterimSite.siteContactDetails.validation.emailRequired'
      )
    } else if (!EMAIL_REGEX.test(fields.siteContactEmail)) {
      errors.siteContactEmail = t(
        'pages.addInterimSite.siteContactDetails.validation.emailInvalid'
      )
    }
    if (!fields.siteContactPhone) {
      errors.siteContactPhone = t(
        'pages.addInterimSite.siteContactDetails.validation.phoneRequired'
      )
    }

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
