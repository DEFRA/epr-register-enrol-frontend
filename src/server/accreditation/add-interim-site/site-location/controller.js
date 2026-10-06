import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'
import {
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../../../common/constants/siteFieldLimits.js'

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
      addressLine1: session.addressLine1 ?? '',
      addressLine2: session.addressLine2 ?? '',
      townOrCity: session.townOrCity ?? '',
      stateOrRegion: session.stateOrRegion ?? '',
      postcode: session.postcode ?? ''
    }
    return renderPage(h, buildViewData(t, applicationId, fields, {}))
  }
}

const MAX_LENGTH_RULES = [
  ['addressLine1', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine1TooLong'],
  ['addressLine2', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine2TooLong'],
  ['townOrCity', SITE_FIELD_MAX_LENGTHS.townOrCity, 'townOrCityTooLong'],
  [
    'stateOrRegion',
    SITE_FIELD_MAX_LENGTHS.stateOrRegion,
    'stateOrRegionTooLong'
  ],
  ['postcode', SITE_FIELD_MAX_LENGTHS.postcode, 'postcodeTooLong']
]

function addMaxLengthErrors(t, fields, errors) {
  for (const [field, maxLength, key] of MAX_LENGTH_RULES) {
    if (!errors[field] && exceedsMaxLength(fields[field], maxLength)) {
      errors[field] = t(`pages.addInterimSite.siteLocation.validation.${key}`)
    }
  }
}

export const addInterimSiteLocationPostController = {
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
    addMaxLengthErrors(t, fields, errors)

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
