import { BASEL_OECD_CODES } from '../data/baselOecdCodes.js'
import {
  ORS_CONTACT_PHONE_RULES,
  SITE_FIELD_MAX_LENGTHS,
  exceedsMaxLength
} from '../constants/siteFieldLimits.js'
import { validateSiteContactDetails } from './siteContactDetails.js'

// The add-overseas-site wizard's per-step rules, in one place so the steps
// themselves and every check that a site's saved answers are complete run
// exactly the same code. Each returns the translated message (or null / an
// errors object), so a caller can show it wherever it needs to.

const SITE_NAME_KEYS = 'pages.addOverseasSite.siteName.validation'

export function validateSiteName(t, siteName) {
  if (!siteName) {
    return t(`${SITE_NAME_KEYS}.required`)
  }
  if (exceedsMaxLength(siteName, SITE_FIELD_MAX_LENGTHS.siteName)) {
    return t(`${SITE_NAME_KEYS}.tooLong`)
  }
  return null
}

// RA-468: the phone is optional here (only validated once entered) and the
// contact name must not contain digits.
const CONTACT_VALIDATION_OPTIONS = {
  keyPrefix: 'pages.addOverseasSite.siteContactDetails.validation',
  phoneRequired: false,
  nameRejectsDigits: true,
  phoneRules: ORS_CONTACT_PHONE_RULES
}

export function validateOrsContactDetails(t, fields) {
  return validateSiteContactDetails(t, fields, CONTACT_VALIDATION_OPTIONS)
}

const CODES_BY_MATERIAL_TYPE = {
  Aluminium: ['R4', 'R12', 'R13'],
  Fibre: ['R3', 'R5', 'R12', 'R13'],
  Glass: ['R5', 'R12', 'R13'],
  Paper: ['R3', 'R12', 'R13'],
  Plastic: ['R3', 'R12', 'R13'],
  Steel: ['R4', 'R12', 'R13'],
  Wood: ['R3', 'R12', 'R13']
}

const ALL_CODES = ['R3', 'R4', 'R5', 'R12', 'R13']
// RA-486: R3/R4/R5 are the mandatory "material" codes on the ORS recycling
// operations question — at least one must be selected. R12/R13 are optional
// here (they no longer force an interim site; adding one is now an
// independent action on the CYA page).
const CORE_CODES = new Set(['R3', 'R4', 'R5'])

export function applicableCodesForMaterialType(materialType) {
  // Falls back to the full set when materialType is missing/unrecognised
  // (shouldn't happen in the real journey) rather than showing no options at all.
  return CODES_BY_MATERIAL_TYPE[materialType] ?? ALL_CODES
}

export function hasCoreCode(codes) {
  return codes.some((code) => CORE_CODES.has(code))
}

const RECYCLING_KEYS =
  'pages.addOverseasSite.recyclingOperationDetails.validation'

export function validateRecyclingOperationCodes(t, codes, materialType) {
  const applicable = applicableCodesForMaterialType(materialType)
  if (codes.length === 0 || !codes.every((code) => applicable.includes(code))) {
    return t(`${RECYCLING_KEYS}.required`)
  }
  if (!hasCoreCode(codes)) {
    return t(`${RECYCLING_KEYS}.coreCodeRequired`)
  }
  return null
}

const BASEL_OECD_CODES_SET = new Set(
  BASEL_OECD_CODES.map((code) => code.toUpperCase())
)

// Extracted from addOrsBaselCodePostController (SonarCloud: function too
// long) — the invalid/duplicate/at-least-one-required checks are a
// self-contained pass over `values` with no dependency on the rest of the
// handler's flow. Errors are keyed by the index of the offending entry.
export function validateBaselCodes(values, t) {
  const errors = {}
  const seenCodes = new Set()
  let anyCodeEntered = false

  values.forEach((value, index) => {
    if (!value) {
      return
    }

    anyCodeEntered = true

    if (!BASEL_OECD_CODES_SET.has(value.toUpperCase())) {
      errors[index] = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.codeInvalid'
      )
      return
    }

    if (seenCodes.has(value.toUpperCase())) {
      errors[index] = t(
        'pages.addOverseasSite.baselAndOecdCodes.validation.duplicateCode'
      )
      return
    }

    seenCodes.add(value.toUpperCase())
  })

  if (!anyCodeEntered) {
    errors[0] = t(
      'pages.addOverseasSite.baselAndOecdCodes.validation.atLeastOneCodeRequired'
    )
  }

  return errors
}

const REPATRIATED_KEYS = 'pages.addOverseasSite.repatriatedLoads.validation'
const MAX_REPATRIATED_WORDS = 500

export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * @returns {{message: string, tooManyWords: boolean} | null} tooManyWords is
 *   set only for the word limit, which the page's live counter can clear in
 *   the browser; the other messages must stay put until the next submit.
 */
export function validateRepatriatedLoads(t, text) {
  if (!text) {
    return { message: t(`${REPATRIATED_KEYS}.required`), tooManyWords: false }
  }
  if (countWords(text) > MAX_REPATRIATED_WORDS) {
    return {
      message: t(`${REPATRIATED_KEYS}.tooManyWords`),
      tooManyWords: true
    }
  }
  // RA-620: 500 words can still run past the backend's 5000-character cap
  // (long words, or a pasted list with heavy punctuation), so both apply.
  // Counted as submitted, line breaks as the browser's CRLF, because that is
  // the string the backend receives and measures. Not flagged tooManyWords:
  // the browser clears a "length" error once the text is back under 500
  // words, which says nothing about this limit.
  if (exceedsMaxLength(text, SITE_FIELD_MAX_LENGTHS.repatriatedLoads)) {
    return {
      message: t(`${REPATRIATED_KEYS}.tooManyCharacters`),
      tooManyWords: false
    }
  }
  return null
}

const STEEL_ALU_MATERIALS = new Set(['Steel', 'Aluminium'])

export function requiresConditionsOfExport(materialType) {
  return STEEL_ALU_MATERIALS.has(materialType)
}

export function validateConditionsOfExport(t, value, materialType) {
  if (!requiresConditionsOfExport(materialType)) {
    return null
  }
  return typeof value === 'boolean'
    ? null
    : t('pages.addOverseasSite.conditionsOfExport.validation.required')
}
