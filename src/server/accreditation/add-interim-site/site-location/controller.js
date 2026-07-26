import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-name`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-contact-details`
}

function renderPage(h, viewData) {
  return h.view('accreditation/add-interim-site/site-location/index', viewData)
}

function buildViewData(t, applicationId, fields, errors) {
  return {
    pageTitle: t('pages.addInterimSite.siteLocation.title'),
    heading: t('pages.addInterimSite.siteLocation.heading'),
    continueButton: t('pages.addInterimSite.siteName.continueButton'),
    cancelLink: t('pages.addInterimSite.siteName.cancelLink'),
    backLink: siteNameUrl(applicationId),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    fields,
    errors
  }
}

function extractFields(payload) {
  return {
    addressLine1: (payload?.addressLine1 ?? '').trim(),
    addressLine2: (payload?.addressLine2 ?? '').trim(),
    townOrCity: (payload?.townOrCity ?? '').trim(),
    stateOrRegion: (payload?.stateOrRegion ?? '').trim(),
    postcode: (payload?.postcode ?? '').trim()
  }
}

export const addInterimSiteLocationGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddInterimSiteSession(request)
    const fields = {
      addressLine1: session.addressLine1 ?? '',
      addressLine2: session.addressLine2 ?? '',
      townOrCity: session.townOrCity ?? '',
      stateOrRegion: session.stateOrRegion ?? '',
      postcode: session.postcode ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addInterimSiteLocationPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const fields = extractFields(request.payload)
    const errors = {}

    if (!fields.addressLine1) {
      errors.addressLine1 = t(
        'pages.addInterimSite.siteLocation.validation.addressLine1Required'
      )
    }
    if (!fields.townOrCity) {
      errors.townOrCity = t(
        'pages.addInterimSite.siteLocation.validation.townOrCityRequired'
      )
    }

    if (Object.keys(errors).length > 0) {
      return renderPage(
        h,
        buildViewData(t, applicationId, fields, errors)
      ).code(400)
    }

    setAddInterimSiteSession(request, fields)
    return h.redirect(siteContactDetailsUrl(applicationId))
  }
}
