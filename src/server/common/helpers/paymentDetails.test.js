import { describe, test, expect } from 'vitest'
import {
  buildInYearOrsPaymentDetails,
  buildPaymentDetails,
  requirePaymentReference
} from './paymentDetails.js'
import { NATIONS } from './nation-from-postcode.js'

const identityTranslator = (key) => key

function makeApplication(sites) {
  return {
    prns: { plannedTonnageBand: 'UpTo500' },
    overseasSites: { sites }
  }
}

describe('requirePaymentReference', () => {
  test('returns the reference the backend built', () => {
    expect(
      requirePaymentReference({ paymentReference: 'PR/PK/REP/500001' })
    ).toBe('PR/PK/REP/500001')
  })

  test.each([
    ['null', { paymentReference: null }],
    ['missing', {}],
    ['empty', { paymentReference: '' }]
  ])('throws when the reference is %s', (_label, application) => {
    expect(() => requirePaymentReference(application)).toThrow(
      'Application has no payment reference'
    )
  })
})

// RA-477: interim sites are chargeable-for-information only, nested under their
// linked ORS as site.interimSite — they must never inflate numberOfORSs/amountOrsDue.
describe('buildPaymentDetails - ORS vs interim site fee counting (RA-477)', () => {
  test('counts 2 ORS with no interim sites as 2', () => {
    const application = makeApplication([{ siteId: 1 }, { siteId: 2 }])

    const result = buildPaymentDetails(
      application,
      identityTranslator,
      NATIONS.ENGLAND
    )

    expect(result.numberOfORSs).toBe(2)
    expect(result.amountOrsDue).toBe(656)
  })

  test('2 ORS with 1 nested interim site still counts as 2, not 3', () => {
    const application = makeApplication([
      {
        siteId: 1,
        interimSite: { siteId: 101, siteName: 'Interim A' }
      },
      { siteId: 2 }
    ])

    const result = buildPaymentDetails(
      application,
      identityTranslator,
      NATIONS.ENGLAND
    )

    expect(result.numberOfORSs).toBe(2)
    expect(result.amountOrsDue).toBe(656)
  })

  test('N ORS where every site has a nested interim site still counts as N', () => {
    const application = makeApplication([
      { siteId: 1, interimSite: { siteId: 101, siteName: 'Interim A' } },
      { siteId: 2, interimSite: { siteId: 102, siteName: 'Interim B' } },
      { siteId: 3, interimSite: { siteId: 103, siteName: 'Interim C' } }
    ])

    const result = buildPaymentDetails(
      application,
      identityTranslator,
      NATIONS.ENGLAND
    )

    expect(result.numberOfORSs).toBe(3)
    expect(result.amountOrsDue).toBe(984)
  })

  test('a deselected ORS with a nested interim site is still excluded from the count', () => {
    const application = makeApplication([
      { siteId: 1 },
      {
        siteId: 2,
        selected: false,
        interimSite: { siteId: 102, siteName: 'Interim B' }
      }
    ])

    const result = buildPaymentDetails(
      application,
      identityTranslator,
      NATIONS.ENGLAND
    )

    expect(result.numberOfORSs).toBe(1)
    expect(result.amountOrsDue).toBe(328)
  })
})

describe('buildInYearOrsPaymentDetails (RA-492)', () => {
  const t = (key) => key

  test('takes the amount from the backend charge, with no tonnage fee', () => {
    const details = buildInYearOrsPaymentDetails(
      { materialType: 'Plastic' },
      t,
      NATIONS.WALES,
      { chargeableSites: 3, chargePerSitePence: 32800, totalPence: 98400 }
    )
    expect(details.amount).toBe(984)
    expect(details.amountOrsDue).toBe(984)
    expect(details.numberOfORSs).toBe(3)
    expect(details.tonnageDisplay).toBeUndefined()
    expect(details.companyName).toBe('Natural Resources Wales')
  })

  test('uses the England bank details for an unknown nation', () => {
    const details = buildInYearOrsPaymentDetails(
      { materialType: 'Plastic' },
      t,
      'Atlantis',
      { chargeableSites: 1, chargePerSitePence: 32800, totalPence: 32800 }
    )
    expect(details.companyName).toBe('Environment Agency')
    expect(details.amount).toBe(328)
  })
})
