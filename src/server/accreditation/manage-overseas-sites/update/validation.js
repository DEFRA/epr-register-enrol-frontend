// RA-682: the update steps' checks, with the add-overseas-site and
// add-interim-site journeys' own messages and limits, so a change is held to
// the rules the details were first entered under. The backend applies the same
// rules and its refusal is shown when it disagrees.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/
const PHONE = /^[0-9+()\-\s]*$/

function checks(t, rules, fields) {
  const errors = {}
  for (const [field, list] of Object.entries(rules)) {
    const value = fields[field] ?? ''
    const failed = list.find(([test]) => !test(value))
    if (failed) {
      errors[field] = t(failed[1])
    }
  }
  return errors
}

const required = (v) => v.trim() !== ''
const max = (n) => (v) => v.length <= n

const ORS = 'pages.addOverseasSite'
const INTERIM = 'pages.addInterimSite'

const ORS_RULES = {
  'site-name': {
    siteName: [
      [required, `${ORS}.siteName.validation.required`],
      [max(200), `${ORS}.siteName.validation.tooLong`]
    ]
  },
  location: {
    addressLine1: [
      [required, `${ORS}.siteLocation.validation.addressLine1Required`],
      [max(200), `${INTERIM}.siteLocation.validation.addressLine1TooLong`]
    ],
    addressLine2: [
      [max(200), `${INTERIM}.siteLocation.validation.addressLine2TooLong`]
    ],
    townOrCity: [
      [required, `${ORS}.siteLocation.validation.townOrCityRequired`],
      [max(100), `${INTERIM}.siteLocation.validation.townOrCityTooLong`]
    ]
  },
  'contact-details': {
    contactName: [
      [required, `${ORS}.siteContactDetails.validation.nameRequired`],
      [max(200), `${ORS}.siteContactDetails.validation.nameTooLong`]
    ],
    contactEmail: [
      [required, `${ORS}.siteContactDetails.validation.emailRequired`],
      [
        (v) => EMAIL.test(v),
        `${ORS}.siteContactDetails.validation.emailInvalid`
      ],
      [max(254), `${ORS}.siteContactDetails.validation.emailTooLong`]
    ],
    contactPhone: [
      [
        (v) => PHONE.test(v),
        `${ORS}.siteContactDetails.validation.phoneInvalid`
      ]
    ]
  },
  'rejected-loads': {
    repatriatedLoads: [
      [required, `${ORS}.repatriatedLoads.validation.required`],
      [max(5000), `${ORS}.repatriatedLoads.validation.tooManyCharacters`]
    ]
  }
}

export function validateStep(t, step, fields) {
  return checks(t, ORS_RULES[step], fields)
}

const INTERIM_RULES = {
  siteName: [
    [required, `${INTERIM}.siteName.validation.required`],
    [max(200), `${INTERIM}.siteName.validation.tooLong`]
  ],
  addressLine1: [
    [required, `${INTERIM}.siteLocation.validation.addressLine1Required`],
    [max(200), `${INTERIM}.siteLocation.validation.addressLine1TooLong`]
  ],
  addressLine2: [
    [max(200), `${INTERIM}.siteLocation.validation.addressLine2TooLong`]
  ],
  townOrCity: [
    [required, `${INTERIM}.siteLocation.validation.townOrCityRequired`],
    [max(100), `${INTERIM}.siteLocation.validation.townOrCityTooLong`]
  ],
  stateOrRegion: [
    [max(100), `${INTERIM}.siteLocation.validation.stateOrRegionTooLong`]
  ],
  postcode: [[max(20), `${INTERIM}.siteLocation.validation.postcodeTooLong`]],
  contactName: [
    [required, `${INTERIM}.siteContactDetails.validation.nameRequired`],
    [max(200), `${INTERIM}.siteContactDetails.validation.nameTooLong`]
  ],
  contactEmail: [
    [required, `${INTERIM}.siteContactDetails.validation.emailRequired`],
    [
      (v) => EMAIL.test(v),
      `${INTERIM}.siteContactDetails.validation.emailInvalid`
    ],
    [max(254), `${INTERIM}.siteContactDetails.validation.emailTooLong`]
  ],
  contactPhone: [
    [required, `${INTERIM}.siteContactDetails.validation.phoneRequired`],
    [
      (v) => PHONE.test(v),
      `${INTERIM}.siteContactDetails.validation.phoneInvalid`
    ]
  ]
}

const NEW_INTERIM_RULES = {
  country: [[required, `${INTERIM}.country.validation.required`]],
  operationCodes: [
    [
      (codes) => codes.length > 0,
      `${INTERIM}.recyclingOperationDetails.validation.required`
    ],
    [
      (codes) => codes.includes('R12') || codes.includes('R13'),
      `${INTERIM}.recyclingOperationDetails.validation.coreCodeRequired`
    ]
  ]
}

/** An interim site's form. A new one also needs its country and recycling operations. */
export function validateInterim(t, fields, { isNew }) {
  const errors = checks(t, INTERIM_RULES, fields)
  if (isNew) {
    Object.assign(errors, checks(t, NEW_INTERIM_RULES, fields))
  }
  return errors
}
