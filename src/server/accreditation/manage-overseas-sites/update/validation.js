import {
  validateOrsContactDetails,
  validateRepatriatedLoads,
  validateSiteName
} from '../../../common/helpers/overseasSiteAnswerValidation.js'
import { validateSiteAddressFields } from '../../../common/helpers/overseasSiteLocationValidation.js'
import {
  validateInterimContactDetails,
  validateInterimCountry,
  validateInterimOperationCodes,
  validateInterimSiteLocation,
  validateInterimSiteName
} from '../../../common/helpers/interimSiteValidation.js'

// RA-682: a change is held to the rules the details were first entered under,
// so these are the add-overseas-site and add-interim-site journeys' own.

// The shared contact rules name their fields after the wizards' form fields.
const CONTACT_FIELDS = {
  siteContactName: 'contactName',
  siteContactEmail: 'contactEmail',
  siteContactPhone: 'contactPhone'
}

function contactErrors(validate, t, fields) {
  const errors = validate(
    t,
    Object.fromEntries(
      Object.entries(CONTACT_FIELDS).map(([wizard, name]) => [
        wizard,
        fields[name] ?? ''
      ])
    )
  )
  return Object.fromEntries(
    Object.entries(errors).map(([wizard, message]) => [
      CONTACT_FIELDS[wizard],
      message
    ])
  )
}

function only(name, message) {
  return message ? { [name]: message } : {}
}

const STEP_RULES = {
  'site-name': (t, fields) =>
    only('siteName', validateSiteName(t, fields.siteName)),
  location: (t, fields) => validateSiteAddressFields(t, fields),
  'contact-details': (t, fields) =>
    contactErrors(validateOrsContactDetails, t, fields)
}

/**
 * The errors on one ORS detail step, keyed by field. `tooManyWords` says the
 * rejected-loads error is the word limit, which the page's live counter clears.
 */
export function validateStep(t, step, fields) {
  if (step === 'rejected-loads') {
    const refused = validateRepatriatedLoads(t, fields.repatriatedLoads)
    return {
      errors: only('repatriatedLoads', refused?.message),
      tooManyWords: refused?.tooManyWords ?? false
    }
  }
  return { errors: STEP_RULES[step](t, fields), tooManyWords: false }
}

/** An interim site's form. A new one also needs its country and recycling operations. */
export function validateInterim(t, fields, { isNew }) {
  const errors = {
    ...only('siteName', validateInterimSiteName(t, fields.siteName)),
    ...validateInterimSiteLocation(t, fields),
    ...contactErrors(validateInterimContactDetails, t, fields)
  }
  if (isNew) {
    Object.assign(
      errors,
      only('country', validateInterimCountry(t, fields.country)),
      only(
        'operationCodes',
        validateInterimOperationCodes(t, fields.operationCodes)
      )
    )
  }
  return errors
}
