import { describe, test, expect } from 'vitest'
import {
  extractSiteContactFields,
  validateSiteContactDetails
} from './siteContactDetails.js'
import {
  INTERIM_CONTACT_PHONE_RULES,
  ORS_CONTACT_PHONE_RULES
} from '../constants/siteFieldLimits.js'

const t = (key) => key
const valid = {
  siteContactName: 'Jane Smith',
  siteContactEmail: 'jane@example.com',
  siteContactPhone: '+44 20 7946 0958'
}
const options = {
  keyPrefix: 'v',
  phoneRequired: true,
  nameRejectsDigits: false,
  phoneRules: ORS_CONTACT_PHONE_RULES
}
const interimOptions = { ...options, phoneRules: INTERIM_CONTACT_PHONE_RULES }

// A syntactically valid address of exactly `length` characters.
const emailOfLength = (length) =>
  `${'a'.repeat(length - '@example.com'.length)}@example.com`

describe('#extractSiteContactFields', () => {
  test('trims values and defaults missing ones to empty strings', () => {
    expect(
      extractSiteContactFields({ siteContactName: '  Jane ', crumb: 'x' })
    ).toEqual({
      siteContactName: 'Jane',
      siteContactEmail: '',
      siteContactPhone: ''
    })
  })

  test('copes with a missing payload', () => {
    expect(extractSiteContactFields(undefined)).toEqual({
      siteContactName: '',
      siteContactEmail: '',
      siteContactPhone: ''
    })
  })
})

describe('#validateSiteContactDetails', () => {
  test('returns no errors for valid fields', () => {
    expect(validateSiteContactDetails(t, valid, options)).toEqual({})
  })

  test('prefixes message keys with the supplied keyPrefix', () => {
    const errors = validateSiteContactDetails(
      t,
      {
        siteContactName: '',
        siteContactEmail: 'nope',
        siteContactPhone: 'abc'
      },
      options
    )
    expect(errors).toEqual({
      siteContactName: 'v.nameRequired',
      siteContactEmail: 'v.emailInvalid',
      siteContactPhone: 'v.phoneInvalid'
    })
  })

  test('requires the phone only when phoneRequired is set', () => {
    const fields = { ...valid, siteContactPhone: '' }
    expect(validateSiteContactDetails(t, fields, options)).toEqual({
      siteContactPhone: 'v.phoneRequired'
    })
    expect(
      validateSiteContactDetails(t, fields, {
        ...options,
        phoneRequired: false
      })
    ).toEqual({})
  })

  test('rejects digits in the name only when nameRejectsDigits is set', () => {
    const fields = { ...valid, siteContactName: 'Jane2' }
    expect(validateSiteContactDetails(t, fields, options)).toEqual({})
    expect(
      validateSiteContactDetails(t, fields, {
        ...options,
        nameRejectsDigits: true
      })
    ).toEqual({ siteContactName: 'v.nameInvalid' })
  })

  test('reports a required email separately from an invalid one', () => {
    expect(
      validateSiteContactDetails(t, { ...valid, siteContactEmail: '' }, options)
    ).toEqual({ siteContactEmail: 'v.emailRequired' })
  })

  // RA-620: each limit mirrors the backend validator, so the value one past it
  // must be refused here rather than by the backend at check-your-answers.
  describe('backend length limits', () => {
    const errorFor = (fields, opts = options) =>
      validateSiteContactDetails(t, { ...valid, ...fields }, opts)

    test('accepts a 200-character contact name and refuses 201', () => {
      expect(errorFor({ siteContactName: 'a'.repeat(200) })).toEqual({})
      expect(errorFor({ siteContactName: 'a'.repeat(201) })).toEqual({
        siteContactName: 'v.nameTooLong'
      })
    })

    test('accepts a 254-character email and refuses 255', () => {
      expect(emailOfLength(254)).toHaveLength(254)
      expect(errorFor({ siteContactEmail: emailOfLength(254) })).toEqual({})
      expect(errorFor({ siteContactEmail: emailOfLength(255) })).toEqual({
        siteContactEmail: 'v.emailTooLong'
      })
    })

    test('accepts a 30-character overseas site phone and refuses 31', () => {
      expect(errorFor({ siteContactPhone: '1'.repeat(30) })).toEqual({})
      expect(errorFor({ siteContactPhone: '1'.repeat(31) })).toEqual({
        siteContactPhone: 'v.phoneLength'
      })
    })

    test('counts a leading + towards the overseas site phone limit', () => {
      expect(errorFor({ siteContactPhone: `+${'1'.repeat(29)}` })).toEqual({})
      expect(errorFor({ siteContactPhone: `+${'1'.repeat(30)}` })).toEqual({
        siteContactPhone: 'v.phoneLength'
      })
    })

    test('accepts a 7 to 20-character interim site phone and refuses 6 or 21', () => {
      for (const length of [7, 20]) {
        expect(
          errorFor({ siteContactPhone: '1'.repeat(length) }, interimOptions)
        ).toEqual({})
      }
      for (const length of [6, 21]) {
        expect(
          errorFor({ siteContactPhone: '1'.repeat(length) }, interimOptions)
        ).toEqual({ siteContactPhone: 'v.phoneLength' })
      }
    })

    test('does not count a leading + towards the interim site phone limit', () => {
      expect(
        errorFor({ siteContactPhone: `+${'1'.repeat(20)}` }, interimOptions)
      ).toEqual({})
      expect(
        errorFor({ siteContactPhone: `+${'1'.repeat(6)}` }, interimOptions)
      ).toEqual({ siteContactPhone: 'v.phoneLength' })
    })

    test('refuses a + anywhere but the start of an interim site phone', () => {
      expect(
        errorFor({ siteContactPhone: '44+20 7946 0958' }, interimOptions)
      ).toEqual({ siteContactPhone: 'v.phoneInvalid' })
      expect(errorFor({ siteContactPhone: '44+20 7946 0958' })).toEqual({})
    })
  })
})
