import { isValidPhoneNumber } from './phoneNumber.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/
// The contact is a person's name, not a reference/account number — reject any
// digit rather than allow-listing characters, so accented letters,
// apostrophes (O'Brien) and hyphens (Anne-Marie) keep working.
const NAME_CONTAINS_DIGIT_REGEX = /\d/

export function extractSiteContactFields(payload) {
  return {
    siteContactName: (payload?.siteContactName ?? '').trim(),
    siteContactEmail: (payload?.siteContactEmail ?? '').trim(),
    siteContactPhone: (payload?.siteContactPhone ?? '').trim()
  }
}

// Sequential early returns rather than if/else-if, so each field's rule count
// can grow without tripping Sonar's complexity (S1541) / missing-else (S126)
// rules.
function validateName(message, name, { nameRejectsDigits }) {
  if (!name) {
    return message('nameRequired')
  }
  if (nameRejectsDigits && NAME_CONTAINS_DIGIT_REGEX.test(name)) {
    return message('nameInvalid')
  }
  return null
}

function validateEmail(message, email) {
  if (!email) {
    return message('emailRequired')
  }
  if (!EMAIL_REGEX.test(email)) {
    return message('emailInvalid')
  }
  return null
}

function validatePhone(message, phone, { phoneRequired }) {
  if (!phone) {
    return phoneRequired ? message('phoneRequired') : null
  }
  if (!isValidPhoneNumber(phone)) {
    return message('phoneInvalid')
  }
  return null
}

/**
 * Validates the contact name/email/phone fields shared by the ORS and interim
 * site wizards.
 * @param {(key: string) => string} t - translator
 * @param {{siteContactName: string, siteContactEmail: string, siteContactPhone: string}} fields
 * @param {{keyPrefix: string, phoneRequired: boolean, nameRejectsDigits: boolean}} options
 *   keyPrefix: translation key prefix holding the page's validation messages
 * @returns {Record<string, string>} field name -> error message
 */
export function validateSiteContactDetails(t, fields, options) {
  const message = (key) => t(`${options.keyPrefix}.${key}`)
  const candidates = {
    siteContactName: validateName(message, fields.siteContactName, options),
    siteContactEmail: validateEmail(message, fields.siteContactEmail),
    siteContactPhone: validatePhone(message, fields.siteContactPhone, options)
  }
  return Object.fromEntries(
    Object.entries(candidates).filter(([, error]) => error)
  )
}
