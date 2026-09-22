import { describe, test, expect } from 'vitest'
import {
  extractSiteContactFields,
  validateSiteContactDetails
} from './siteContactDetails.js'

const t = (key) => key
const valid = {
  siteContactName: 'Jane Smith',
  siteContactEmail: 'jane@example.com',
  siteContactPhone: '+44 20 7946 0958'
}
const options = {
  keyPrefix: 'v',
  phoneRequired: true,
  nameRejectsDigits: false
}

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
})
