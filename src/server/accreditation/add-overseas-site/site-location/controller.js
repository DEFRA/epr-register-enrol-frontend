import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import { COUNTRIES } from '../../../common/data/countries.js'
import { validateSiteLocationFields } from '../../../common/helpers/overseasSiteLocationValidation.js'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-name`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-contact-details`
}

function renderPage(h, viewData) {
  return h.view('accreditation/add-overseas-site/site-location/index', viewData)
}

function buildViewData(t, applicationId, fields, errors) {
  return {
    pageTitle: t('pages.addOverseasSite.siteLocation.title'),
    heading: t('pages.addOverseasSite.siteLocation.heading'),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    backLink: siteNameUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    countries: COUNTRIES,
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
    postcode: (payload?.postcode ?? '').trim(),
    country: (payload?.country ?? '').trim(),
    coordinates: (payload?.coordinates ?? '').trim()
  }
}

export const addOrsSiteLocationGetController = {
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
      addressLine1: session.addressLine1 ?? '',
      addressLine2: session.addressLine2 ?? '',
      townOrCity: session.townOrCity ?? '',
      stateOrRegion: session.stateOrRegion ?? '',
      postcode: session.postcode ?? '',
      country: session.country ?? '',
      coordinates: session.coordinates ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

export const addOrsSiteLocationPostController = {
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

    const fields = extractFields(request.payload)
    const errors = validateSiteLocationFields(t, fields)

    if (Object.keys(errors).length > 0) {
      return renderPage(
        h,
        buildViewData(t, applicationId, fields, errors)
      ).code(400)
    }

    setAddOrsSession(request, fields)
    return h.redirect(siteContactDetailsUrl(applicationId))
  }
}
