import {
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../constants/siteFieldLimits.js'

// The add-overseas-site wizard's "where is it" rules, shared so the same checks
// run on the location step and on every check that a site's saved answers are
// complete (RA-597). Moved out of the site-location controller unchanged.

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180
const MIN_COORDINATE_DECIMAL_PLACES = 4
// RA-580-2: new ceiling — 4 dp remains the required minimum accuracy, 10 dp is the max.
const MAX_COORDINATE_DECIMAL_PLACES = 10
const COORDINATE_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/
// RA-468: a place name, not a free-text address line — letters plus the
// punctuation real town/city names use (spaces, hyphens, apostrophes), e.g.
// "Stratford-upon-Avon", "King's Lynn". No digits or other symbols. The
// lookahead requires at least one letter, so a value made up of only
// punctuation (e.g. "-'-") isn't waved through as a "valid" town/city
// (review: masante).
const TOWN_OR_CITY_REGEX = /^(?=.*\p{L})[\p{L}\s'-]+$/u

function decimalPlaces(value) {
  const pointIndex = value.indexOf('.')
  return pointIndex === -1 ? 0 : value.length - pointIndex - 1
}

function splitCoordinateParts(trimmed) {
  const parts = trimmed.split(',')
  if (parts.length !== 2) {
    return null
  }
  return [parts[0].trim(), parts[1].trim()]
}

function coordinateRangeError(lat, lng) {
  if (lat < MIN_LATITUDE || lat > MAX_LATITUDE) {
    return 'latRange'
  }
  if (lng < MIN_LONGITUDE || lng > MAX_LONGITUDE) {
    return 'lngRange'
  }
  return null
}

function isWithinAllowedPrecision(value) {
  const places = decimalPlaces(value)
  return (
    places >= MIN_COORDINATE_DECIMAL_PLACES &&
    places <= MAX_COORDINATE_DECIMAL_PLACES
  )
}

function coordinatePrecisionError(latRaw, lngRaw) {
  const hasAllowedPrecision =
    isWithinAllowedPrecision(latRaw) && isWithinAllowedPrecision(lngRaw)
  return hasAllowedPrecision ? null : 'precision'
}

function parseCoordinates(raw) {
  const trimmed = (raw ?? '').trim()
  const parts = splitCoordinateParts(trimmed)
  if (!parts) {
    return { valid: false, error: 'invalid' }
  }

  const [latRaw, lngRaw] = parts
  if (
    !COORDINATE_NUMBER_PATTERN.test(latRaw) ||
    !COORDINATE_NUMBER_PATTERN.test(lngRaw)
  ) {
    return { valid: false, error: 'invalid' }
  }

  const rangeError = coordinateRangeError(
    Number.parseFloat(latRaw),
    Number.parseFloat(lngRaw)
  )
  if (rangeError) {
    return { valid: false, error: rangeError }
  }

  const precisionError = coordinatePrecisionError(latRaw, lngRaw)
  if (precisionError) {
    return { valid: false, error: precisionError }
  }

  return { valid: true, value: trimmed }
}

const COORDINATES_ERROR_KEYS = {
  latRange: 'coordinatesLatRange',
  lngRange: 'coordinatesLngRange',
  precision: 'coordinatesPrecision',
  invalid: 'coordinatesInvalid'
}

// RA-468: mirrors validateCoordinates below — sequential early returns
// rather than if/else-if, so a third rule (after "required") slots in
// without the branch nesting Sonar's complexity/S126 rules flag.
function validateTownOrCity(t, townOrCity) {
  if (!townOrCity) {
    return t('pages.addOverseasSite.siteLocation.validation.townOrCityRequired')
  }
  if (!TOWN_OR_CITY_REGEX.test(townOrCity)) {
    return t('pages.addOverseasSite.siteLocation.validation.townOrCityInvalid')
  }
  return null
}

function validateRequiredFields(t, fields) {
  const errors = {}
  if (!fields.addressLine1) {
    errors.addressLine1 = t(
      'pages.addOverseasSite.siteLocation.validation.addressLine1Required'
    )
  }
  const townOrCityError = validateTownOrCity(t, fields.townOrCity)
  if (townOrCityError) {
    errors.townOrCity = townOrCityError
  }
  if (!fields.country) {
    errors.country = t(
      'pages.addOverseasSite.siteLocation.validation.countryRequired'
    )
  }
  return errors
}

function validateCoordinates(t, coordinates) {
  if (!coordinates) {
    return t(
      'pages.addOverseasSite.siteLocation.validation.coordinatesRequired'
    )
  }

  const coordResult = parseCoordinates(coordinates)
  if (coordResult.valid) {
    return null
  }

  const key = COORDINATES_ERROR_KEYS[coordResult.error]
  return t(`pages.addOverseasSite.siteLocation.validation.${key}`)
}

// RA-620: only the fields sent to the backend - stateOrRegion and postcode are
// collected on this page but are not part of the overseas site payload.
const MAX_LENGTH_RULES = [
  ['addressLine1', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine1TooLong'],
  ['addressLine2', SITE_FIELD_MAX_LENGTHS.addressLine, 'addressLine2TooLong'],
  ['townOrCity', SITE_FIELD_MAX_LENGTHS.townOrCity, 'townOrCityTooLong'],
  ['country', SITE_FIELD_MAX_LENGTHS.country, 'countryTooLong']
]

function addMaxLengthErrors(t, fields, errors) {
  for (const [field, maxLength, key] of MAX_LENGTH_RULES) {
    if (!errors[field] && exceedsMaxLength(fields[field], maxLength)) {
      errors[field] = t(`pages.addOverseasSite.siteLocation.validation.${key}`)
    }
  }
}

export function validateSiteLocationFields(t, fields) {
  const errors = validateRequiredFields(t, fields)
  addMaxLengthErrors(t, fields, errors)
  const coordinatesError = validateCoordinates(t, fields.coordinates)
  if (coordinatesError) {
    errors.coordinates = coordinatesError
  }
  return errors
}
