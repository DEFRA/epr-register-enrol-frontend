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

const errorsOnly = (rule) => (t, fields) => ({
  errors: rule(t, fields),
  tooManyWords: false
})

/**
 * Each ORS detail step's errors, keyed by field. `tooManyWords` says the
 * rejected-loads error is the word limit, which the page's live counter clears.
 */
export const STEP_VALIDATORS = {
  siteName: errorsOnly((t, fields) =>
    only('siteName', validateSiteName(t, fields.siteName))
  ),
  location: errorsOnly(validateSiteAddressFields),
  contactDetails: errorsOnly((t, fields) =>
    contactErrors(validateOrsContactDetails, t, fields)
  ),
  repatriatedLoads(t, fields) {
    const refused = validateRepatriatedLoads(t, fields.repatriatedLoads)
    return {
      errors: only('repatriatedLoads', refused?.message),
      tooManyWords: refused?.tooManyWords ?? false
    }
  }
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
