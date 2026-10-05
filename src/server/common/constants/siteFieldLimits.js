// RA-620: mirrors the backend's request validators (epr-register-enrol-backend
// OverseasSiteRequestValidatorBase.cs for overseas site create/update/promote,
// AddInterimSiteRequestValidator.cs for interim sites). A value one of the
// wizard steps accepts but the backend rejects only surfaces at
// check-your-answers, as a 400 the operator sees as a generic error page with
// no way to tell which answer to fix. Change these together with the backend.
//
// Lengths are compared with String#length, which counts UTF-16 code units -
// the same unit .NET's string.Length (and so FluentValidation's
// MaximumLength) uses.
export const SITE_FIELD_MAX_LENGTHS = Object.freeze({
  siteName: 200,
  addressLine: 200,
  townOrCity: 100,
  country: 100,
  stateOrRegion: 100,
  postcode: 20,
  contactName: 200,
  contactEmail: 254,
  repatriatedLoads: 5000
})

// The overseas site validator only caps the phone's length. The interim site
// validator matches /^\+?[0-9()\-\s]{7,20}$/: an optional single leading "+"
// that doesn't count towards the 7-20 characters after it.
export const ORS_CONTACT_PHONE_RULES = Object.freeze({ maxLength: 30 })
export const INTERIM_CONTACT_PHONE_RULES = Object.freeze({
  minLength: 7,
  maxLength: 20,
  leadingPlusOnly: true
})

export function exceedsMaxLength(value, maxLength) {
  return typeof value === 'string' && value.length > maxLength
}

// A coarse size guard for a route's Joi payload schema, set far above every
// real limit above. A value over it gets Hapi's bare 400 page rather than an
// inline error, so it must never be the limit an operator actually meets - it
// only stops absurdly large bodies reaching the handler.
export const PAYLOAD_SIZE_GUARD = 2000
