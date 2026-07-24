import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

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
    fields,
    errors
  }
}

function parseCoordinates(raw) {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { valid: true, value: null }

  const parts = trimmed.split(',')
  if (parts.length !== 2) return { valid: false, error: 'invalid' }

  const lat = parseFloat(parts[0].trim())
  const lng = parseFloat(parts[1].trim())

  if (isNaN(lat) || isNaN(lng)) return { valid: false, error: 'invalid' }
  if (lat < -90 || lat > 90) return { valid: false, error: 'latRange' }
  if (lng < -180 || lng > 180) return { valid: false, error: 'lngRange' }

  return { valid: true, value: trimmed }
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
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
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
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const fields = extractFields(request.payload)
    const errors = {}

    if (!fields.addressLine1) {
      errors.addressLine1 = t(
        'pages.addOverseasSite.siteLocation.validation.addressLine1Required'
      )
    }
    if (!fields.townOrCity) {
      errors.townOrCity = t(
        'pages.addOverseasSite.siteLocation.validation.townOrCityRequired'
      )
    }
    if (!fields.country) {
      errors.country = t(
        'pages.addOverseasSite.siteLocation.validation.countryRequired'
      )
    }

    if (fields.coordinates) {
      const coordResult = parseCoordinates(fields.coordinates)
      if (!coordResult.valid) {
        const key =
          coordResult.error === 'latRange'
            ? 'coordinatesLatRange'
            : coordResult.error === 'lngRange'
              ? 'coordinatesLngRange'
              : 'coordinatesInvalid'
        errors.coordinates = t(
          `pages.addOverseasSite.siteLocation.validation.${key}`
        )
      }
    }

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
