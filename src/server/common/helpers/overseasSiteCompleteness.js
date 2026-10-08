import { validateSiteLocationFields } from './overseasSiteLocationValidation.js'
import {
  validateBaselCodes,
  validateConditionsOfExport,
  validateOrsContactDetails,
  validateRecyclingOperationCodes,
  validateRepatriatedLoads,
  validateSiteName
} from './overseasSiteAnswerValidation.js'

// Is an overseas reprocessing site's data complete? "Complete" means it would
// pass every step of the add-overseas-site wizard if the operator entered it
// from scratch: the same rules, run by the same functions, over the site's
// saved answers. Used by the check-your-answers page, the site list, the
// section confirmation and the submit declaration, so none of them can
// disagree about whether a site is ready.

// Set by the points that turn the operator back to the site list because a
// site is missing details; the list reads it once to explain why.
export const INCOMPLETE_SITES_FLASH = 'orsIncomplete'

// Maps each wizard answer to the persisted site field it is seeded from.
const ANSWER_FIELDS = [
  ['siteName', 'siteName', ''],
  ['addressLine1', 'addressLine1', ''],
  ['addressLine2', 'addressLine2', ''],
  ['townOrCity', 'townOrCity', ''],
  ['country', 'country', ''],
  ['coordinates', 'coordinates', ''],
  ['siteContactName', 'contactName', ''],
  ['siteContactEmail', 'contactEmail', ''],
  ['siteContactPhone', 'contactPhone', ''],
  ['recyclingOperationCodes', 'operationCodes', []],
  ['repatriatedLoads', 'repatriatedLoads', ''],
  ['conditionsOfExport', 'conditionsOfExport', null]
]

/**
 * A persisted site as the wizard's answers (what the wizard session holds).
 */
export function answersFromSite(site) {
  const answers = ANSWER_FIELDS.reduce((acc, [answer, field, fallback]) => {
    acc[answer] = site[field] ?? fallback
    return acc
  }, {})
  answers.baselAndOecdCodes = [site.code1, site.code2, site.code3].filter(
    Boolean
  )
  return answers
}

const text = (value) => (typeof value === 'string' ? value.trim() : '')

// Which check-your-answers row each problem belongs to, and the wizard step
// that fixes it. Row ids are the rows' data-testid values.
const LOCATION_ROW_FIELDS = new Set([
  'addressLine1',
  'addressLine2',
  'townOrCity',
  'country'
])
const CONTACT_ROWS = {
  siteContactName: 'contact-name',
  siteContactEmail: 'contact-email',
  siteContactPhone: 'contact-phone'
}

export const STEP_FOR_ROW = {
  'site-name': 'site-name',
  location: 'site-location',
  coordinates: 'site-location',
  'contact-name': 'site-contact-details',
  'contact-email': 'site-contact-details',
  'contact-phone': 'site-contact-details',
  'recycling-operation': 'recycling-operation-details',
  'basel-codes': 'basel-convention-and-oecd-code',
  'repatriated-loads': 'repatriated-loads',
  'conditions-of-export': 'conditions-of-export'
}

function issue(row, message) {
  return { row, step: STEP_FOR_ROW[row], message }
}

function locationIssues(t, answers) {
  const errors = validateSiteLocationFields(t, {
    addressLine1: text(answers.addressLine1),
    addressLine2: text(answers.addressLine2),
    townOrCity: text(answers.townOrCity),
    country: text(answers.country),
    coordinates: text(answers.coordinates)
  })
  const issues = []
  for (const [field, message] of Object.entries(errors)) {
    if (field === 'coordinates') {
      continue
    }
    if (LOCATION_ROW_FIELDS.has(field)) {
      issues.push(issue('location', message))
    }
  }
  if (errors.coordinates) {
    issues.push(issue('coordinates', errors.coordinates))
  }
  return issues
}

function contactIssues(t, answers) {
  const errors = validateOrsContactDetails(t, {
    siteContactName: text(answers.siteContactName),
    siteContactEmail: text(answers.siteContactEmail),
    siteContactPhone: text(answers.siteContactPhone)
  })
  return Object.entries(CONTACT_ROWS)
    .filter(([field]) => errors[field])
    .map(([field, row]) => issue(row, errors[field]))
}

function baselIssues(t, answers) {
  const codes = (answers.baselAndOecdCodes ?? []).map(text)
  const messages = new Set(Object.values(validateBaselCodes(codes, t)))
  return [...messages].map((message) => issue('basel-codes', message))
}

function singleIssue(row, message) {
  return message ? [issue(row, message)] : []
}

/**
 * Every problem with a site's answers, in the order the wizard asks them.
 *
 * @param {(key: string) => string} t - translator
 * @param {object} answers - wizard answers, see {@link answersFromSite}
 * @param {string} [materialType] - the application's material, which decides
 *   the allowed recycling operations and whether conditions of export apply
 * @returns {{row: string, step: string, message: string}[]} empty when complete
 */
export function findIncompleteAnswers(t, answers, materialType) {
  const codes = Array.isArray(answers.recyclingOperationCodes)
    ? answers.recyclingOperationCodes
    : []
  return [
    ...singleIssue('site-name', validateSiteName(t, text(answers.siteName))),
    ...locationIssues(t, answers),
    ...contactIssues(t, answers),
    ...singleIssue(
      'recycling-operation',
      validateRecyclingOperationCodes(t, codes, materialType)
    ),
    ...baselIssues(t, answers),
    ...singleIssue(
      'repatriated-loads',
      validateRepatriatedLoads(t, text(answers.repatriatedLoads))?.message
    ),
    ...singleIssue(
      'conditions-of-export',
      validateConditionsOfExport(t, answers.conditionsOfExport, materialType)
    )
  ]
}

/**
 * Sites that are part of the application (not merely registered) and have a
 * problem. Whether it came from Re/Ex or from the operator makes no
 * difference.
 *
 * @returns {{site: object, issues: object[]}[]}
 */
export function findIncompleteSites(t, sites, materialType) {
  return (sites ?? [])
    .filter((site) => site.selected !== false)
    .map((site) => ({
      site,
      issues: findIncompleteAnswers(t, answersFromSite(site), materialType)
    }))
    .filter(({ issues }) => issues.length > 0)
}
