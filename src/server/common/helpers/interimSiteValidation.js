import {
  INTERIM_CONTACT_PHONE_RULES,
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../constants/siteFieldLimits.js'
import { validateSiteContactDetails } from './siteContactDetails.js'

// The add-interim-site wizard's per-step rules, shared with the in-year ORS
// update's interim site form (RA-682), so an interim site is held to the same
// rules however it is entered. Each returns the translated message (or an
// errors object), as overseasSiteAnswerValidation.js does for an ORS.

const KEYS = 'pages.addInterimSite'

// RA-486: R12/R13 are the mandatory codes on the interim-site recycling
// operations question — at least one must be selected. R3/R4/R5 are
// optional here (material is inherited from the parent ORS, so there is no
// materialType-based filtering of the option set).
export const INTERIM_OPERATION_CODES = ['R3', 'R4', 'R5', 'R12', 'R13']
const CORE_CODES = new Set(['R12', 'R13'])

function hasInterimCoreCode(codes) {
  return codes.some((code) => CORE_CODES.has(code))
}

function requiredWithMax(t, value, maxLength, keys) {
  if (!value) {
    return t(keys.required)
  }
  if (exceedsMaxLength(value, maxLength)) {
    return t(keys.tooLong)
  }
  return null
}

export function validateInterimSiteName(t, siteName) {
  return requiredWithMax(t, siteName, SITE_FIELD_MAX_LENGTHS.siteName, {
    required: `${KEYS}.siteName.validation.required`,
    tooLong: `${KEYS}.siteName.validation.tooLong`
  })
}

export function validateInterimCountry(t, country) {
  return requiredWithMax(t, country, SITE_FIELD_MAX_LENGTHS.country, {
    required: `${KEYS}.country.validation.required`,
    tooLong: `${KEYS}.country.validation.tooLong`
  })
}

const LOCATION_MAX_LENGTH_RULES = [
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

/** Address line 1 and town or city are required; every line has a length cap. */
export function validateInterimSiteLocation(t, fields) {
  const message = (key) => t(`${KEYS}.siteLocation.validation.${key}`)
  const errors = {}
  if (!fields.addressLine1) {
    errors.addressLine1 = message('addressLine1Required')
  }
  if (!fields.townOrCity) {
    errors.townOrCity = message('townOrCityRequired')
  }
  for (const [field, maxLength, key] of LOCATION_MAX_LENGTH_RULES) {
    if (!errors[field] && exceedsMaxLength(fields[field], maxLength)) {
      errors[field] = message(key)
    }
  }
  return errors
}

export function validateInterimOperationCodes(t, codes) {
  const message = (key) =>
    t(`${KEYS}.recyclingOperationDetails.validation.${key}`)
  if (
    codes.length === 0 ||
    !codes.every((code) => INTERIM_OPERATION_CODES.includes(code))
  ) {
    return message('required')
  }
  if (!hasInterimCoreCode(codes)) {
    return message('coreCodeRequired')
  }
  return null
}

// Unlike an ORS, the phone is required and the name isn't checked for digits.
const CONTACT_VALIDATION_OPTIONS = {
  keyPrefix: `${KEYS}.siteContactDetails.validation`,
  phoneRequired: true,
  nameRejectsDigits: false,
  phoneRules: INTERIM_CONTACT_PHONE_RULES
}

/** Errors keyed siteContactName, siteContactEmail and siteContactPhone. */
export function validateInterimContactDetails(t, fields) {
  return validateSiteContactDetails(t, fields, CONTACT_VALIDATION_OPTIONS)
}
