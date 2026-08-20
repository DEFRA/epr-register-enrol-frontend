import { describe, test, expect } from 'vitest'
import { buildPaymentReference } from './paymentDetails.js'
import { NATIONS } from './nation-from-postcode.js'

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
