import { describe, test, expect } from 'vitest'
import { buildPaymentDetails, buildPaymentReference } from './paymentDetails.js'
import { NATIONS } from './nation-from-postcode.js'

const identityTranslator = (key) => key

function makeApplication(sites) {
  return {
    prns: { plannedTonnageBand: 'UpTo500' },
    overseasSites: { sites }
  }
}

describe('buildPaymentReference', () => {
  test.each([
    [NATIONS.ENGLAND, false, 'PR/PK/REP/ORG123'],
    [NATIONS.ENGLAND, true, 'PR/PK/EXP/ORG123'],
    [NATIONS.NORTHERN_IRELAND, false, 'NI/PR/REEX/ORG123'],
    [NATIONS.NORTHERN_IRELAND, true, 'NI/PR/REEX/ORG123'],
    [NATIONS.WALES, false, 'PREX/ORG123'],
    [NATIONS.WALES, true, 'PREX/ORG123'],
    [NATIONS.SCOTLAND, false, 'E800 81581/ORG123'],
    [NATIONS.SCOTLAND, true, 'E800 81581/ORG123']
  ])(
    'for nation %s and isExporter %s returns %s',
    (nation, isExporter, expected) => {
      expect(buildPaymentReference(nation, 'ORG123', isExporter)).toBe(expected)
    }
  )

  test('falls back to England (Reprocessor) behaviour for an unrecognised nation', () => {
    expect(buildPaymentReference('UNKNOWN', 'ORG123', false)).toBe(
      'PR/PK/REP/ORG123'
    )
  })

  test('falls back to England (Exporter) behaviour for an unrecognised nation', () => {
    expect(buildPaymentReference('UNKNOWN', 'ORG123', true)).toBe(
      'PR/PK/EXP/ORG123'
    )
  })

  test('falls back to England behaviour when nation is undefined', () => {
    expect(buildPaymentReference(undefined, 'ORG123', false)).toBe(
      'PR/PK/REP/ORG123'
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
