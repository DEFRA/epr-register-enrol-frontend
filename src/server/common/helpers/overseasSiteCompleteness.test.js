import { describe, test, expect } from 'vitest'
import {
  answersFromSite,
  findIncompleteAnswers,
  findIncompleteSites
} from './overseasSiteCompleteness.js'

const t = (key) => key
const SITE = 'pages.addOverseasSite'

const COMPLETE_SITE = {
  siteId: 900001,
  siteName: 'Acme Recycling GmbH',
  addressLine1: '1 Hafenstrasse',
  addressLine2: '',
  townOrCity: 'Hamburg',
  country: 'Germany',
  coordinates: '53.5511, 9.9937',
  contactName: 'Greta Schmidt',
  contactEmail: 'greta@example.com',
  contactPhone: '',
  operationCodes: ['R3'],
  code1: 'A1181',
  code2: null,
  code3: null,
  repatriatedLoads: 'Rejected loads are returned within 30 days.',
  conditionsOfExport: null,
  selected: true
}

const issuesFor = (overrides, materialType = 'Plastic') =>
  findIncompleteAnswers(
    t,
    answersFromSite({ ...COMPLETE_SITE, ...overrides }),
    materialType
  )

describe('#answersFromSite', () => {
  test('maps a saved site to the wizard answers, codes as a list', () => {
    expect(
      answersFromSite({ ...COMPLETE_SITE, code2: 'GC030', code3: null })
    ).toEqual({
      siteName: 'Acme Recycling GmbH',
      addressLine1: '1 Hafenstrasse',
      addressLine2: '',
      townOrCity: 'Hamburg',
      country: 'Germany',
      coordinates: '53.5511, 9.9937',
      siteContactName: 'Greta Schmidt',
      siteContactEmail: 'greta@example.com',
      siteContactPhone: '',
      recyclingOperationCodes: ['R3'],
      repatriatedLoads: 'Rejected loads are returned within 30 days.',
      conditionsOfExport: null,
      baselAndOecdCodes: ['A1181', 'GC030']
    })
  })

  test('falls back to empty answers for a site with nothing filled in', () => {
    expect(answersFromSite({ siteId: 1 })).toEqual({
      siteName: '',
      addressLine1: '',
      addressLine2: '',
      townOrCity: '',
      country: '',
      coordinates: '',
      siteContactName: '',
      siteContactEmail: '',
      siteContactPhone: '',
      recyclingOperationCodes: [],
      repatriatedLoads: '',
      conditionsOfExport: null,
      baselAndOecdCodes: []
    })
  })
})

describe('#findIncompleteAnswers', () => {
  test('a site that has everything a fresh add needs is complete', () => {
    expect(issuesFor({})).toEqual([])
  })

  test('the contact phone is optional', () => {
    expect(issuesFor({ contactPhone: '' })).toEqual([])
  })

  test('a site seeded from Re/Ex with only a name reports every gap, in wizard order', () => {
    const issues = findIncompleteAnswers(
      t,
      answersFromSite({ siteId: 1, siteName: 'Re/Ex Site' }),
      'Steel'
    )

    expect(issues.map(({ row }) => row)).toEqual([
      'location',
      'location',
      'location',
      'coordinates',
      'contact-name',
      'contact-email',
      'recycling-operation',
      'basel-codes',
      'repatriated-loads',
      'conditions-of-export'
    ])
    expect(issues.map(({ message }) => message)).toEqual([
      `${SITE}.siteLocation.validation.addressLine1Required`,
      `${SITE}.siteLocation.validation.townOrCityRequired`,
      `${SITE}.siteLocation.validation.countryRequired`,
      `${SITE}.siteLocation.validation.coordinatesRequired`,
      `${SITE}.siteContactDetails.validation.nameRequired`,
      `${SITE}.siteContactDetails.validation.emailRequired`,
      `${SITE}.recyclingOperationDetails.validation.required`,
      `${SITE}.baselAndOecdCodes.validation.atLeastOneCodeRequired`,
      `${SITE}.repatriatedLoads.validation.required`,
      `${SITE}.conditionsOfExport.validation.required`
    ])
  })

  test.each([
    ['siteName', '   ', 'site-name', `${SITE}.siteName.validation.required`],
    [
      'contactName',
      '',
      'contact-name',
      `${SITE}.siteContactDetails.validation.nameRequired`
    ],
    [
      'contactEmail',
      '  ',
      'contact-email',
      `${SITE}.siteContactDetails.validation.emailRequired`
    ],
    [
      'repatriatedLoads',
      '   ',
      'repatriated-loads',
      `${SITE}.repatriatedLoads.validation.required`
    ]
  ])(
    'treats a blank %s as missing, whitespace included',
    (field, value, row, message) => {
      expect(issuesFor({ [field]: value })).toEqual([{ row, message }])
    }
  )

  describe('values that are present but wrong are reported like the wizard would', () => {
    test('a town or city with digits', () => {
      expect(issuesFor({ townOrCity: 'Hamburg 2' })).toEqual([
        {
          row: 'location',
          message: `${SITE}.siteLocation.validation.townOrCityInvalid`
        }
      ])
    })

    test('coordinates with too few decimal places', () => {
      expect(issuesFor({ coordinates: '53.5, 9.9' })).toEqual([
        {
          row: 'coordinates',
          message: `${SITE}.siteLocation.validation.coordinatesPrecision`
        }
      ])
    })

    test('an email in the wrong format', () => {
      expect(issuesFor({ contactEmail: 'not-an-email' })).toEqual([
        {
          row: 'contact-email',
          message: `${SITE}.siteContactDetails.validation.emailInvalid`
        }
      ])
    })

    test('a Basel or OECD code that is not on the approved list', () => {
      expect(issuesFor({ code1: 'ZZ999' })).toEqual([
        {
          row: 'basel-codes',
          message: `${SITE}.baselAndOecdCodes.validation.codeInvalid`
        }
      ])
    })

    test('the same Basel or OECD code twice', () => {
      expect(issuesFor({ code1: 'A1181', code2: 'A1181' })).toEqual([
        {
          row: 'basel-codes',
          message: `${SITE}.baselAndOecdCodes.validation.duplicateCode`
        }
      ])
    })

    test('repatriated loads over the character limit the backend enforces', () => {
      expect(issuesFor({ repatriatedLoads: 'a'.repeat(5001) })).toEqual([
        {
          row: 'repatriated-loads',
          message: `${SITE}.repatriatedLoads.validation.tooManyCharacters`
        }
      ])
    })
  })

  describe('recycling operations depend on the material', () => {
    test('R3 is not a valid code for Steel', () => {
      expect(
        issuesFor({ operationCodes: ['R3'], conditionsOfExport: true }, 'Steel')
      ).toEqual([
        {
          row: 'recycling-operation',
          message: `${SITE}.recyclingOperationDetails.validation.required`
        }
      ])
    })

    test('R12 or R13 alone is not enough: one of R3, R4 or R5 is required', () => {
      expect(issuesFor({ operationCodes: ['R12', 'R13'] })).toEqual([
        {
          row: 'recycling-operation',
          message: `${SITE}.recyclingOperationDetails.validation.coreCodeRequired`
        }
      ])
    })

    test('R12 alongside the material code is fine', () => {
      expect(issuesFor({ operationCodes: ['R3', 'R12'] })).toEqual([])
    })
  })

  describe('conditions of export only apply to Steel and Aluminium', () => {
    test.each(['Steel', 'Aluminium'])('is required for %s', (materialType) => {
      const operationCodes = ['R4']
      expect(
        issuesFor({ operationCodes, conditionsOfExport: null }, materialType)
      ).toEqual([
        {
          row: 'conditions-of-export',
          message: `${SITE}.conditionsOfExport.validation.required`
        }
      ])
      for (const answer of [true, false]) {
        expect(
          issuesFor(
            { operationCodes, conditionsOfExport: answer },
            materialType
          )
        ).toEqual([])
      }
    })

    test.each([
      ['Plastic', 'R3'],
      ['Glass', 'R5'],
      ['Paper', 'R3'],
      ['Wood', 'R3'],
      ['Fibre', 'R5']
    ])('is not asked for %s', (materialType, coreCode) => {
      expect(
        issuesFor(
          { operationCodes: [coreCode], conditionsOfExport: null },
          materialType
        )
      ).toEqual([])
    })
  })
})

describe('#findIncompleteSites', () => {
  const incomplete = (siteId, overrides) => ({
    ...COMPLETE_SITE,
    siteId,
    contactName: '',
    ...overrides
  })

  test('returns each incomplete site in the application with its issues', () => {
    const result = findIncompleteSites(
      t,
      [
        COMPLETE_SITE,
        incomplete(2),
        incomplete(3, { registeredNowAccredited: true }),
        incomplete(4, { isNewSite: true })
      ],
      'Plastic'
    )

    expect(result.map(({ site }) => site.siteId)).toEqual([2, 3, 4])
    expect(result[0].issues).toEqual([
      {
        row: 'contact-name',
        message: `${SITE}.siteContactDetails.validation.nameRequired`
      }
    ])
  })

  test('ignores a registered site that has not been included in the application', () => {
    expect(
      findIncompleteSites(t, [incomplete(5, { selected: false })], 'Plastic')
    ).toEqual([])
  })

  test('treats a site with no selected flag as part of the application', () => {
    const { selected: _selected, ...unflagged } = incomplete(6)
    expect(
      findIncompleteSites(t, [unflagged], 'Plastic').map(
        ({ site }) => site.siteId
      )
    ).toEqual([6])
  })

  test('copes with no sites at all', () => {
    expect(findIncompleteSites(t, undefined, 'Plastic')).toEqual([])
    expect(findIncompleteSites(t, [], 'Plastic')).toEqual([])
  })
})
