import { describe, test, expect } from 'vitest'
import { resolveNationFromPostcode, NATIONS } from './nation-from-postcode.js'

describe('resolveNationFromPostcode', () => {
  test.each([
    ['EH1 1AA', NATIONS.SCOTLAND],
    ['G1 1AA', NATIONS.SCOTLAND],
    ['AB10 1AA', NATIONS.SCOTLAND],
    ['CF10 1AA', NATIONS.WALES],
    ['LL1 1AA', NATIONS.WALES],
    ['SY1 1AA', NATIONS.WALES],
    ['BT1 1AA', NATIONS.NORTHERN_IRELAND],
    ['BL4 7AQ', NATIONS.ENGLAND],
    ['SW1A 1AA', NATIONS.ENGLAND],
    ['ZZ99 9ZZ', NATIONS.ENGLAND]
  ])('resolves %s to %s', (postcode, expected) => {
    expect(resolveNationFromPostcode(postcode)).toBe(expected)
  })

  test('defaults to England when postcode is missing', () => {
    expect(resolveNationFromPostcode(null)).toBe(NATIONS.ENGLAND)
    expect(resolveNationFromPostcode(undefined)).toBe(NATIONS.ENGLAND)
    expect(resolveNationFromPostcode('')).toBe(NATIONS.ENGLAND)
  })

  test('is case-insensitive', () => {
    expect(resolveNationFromPostcode('eh1 1aa')).toBe(NATIONS.SCOTLAND)
    expect(resolveNationFromPostcode('bt1 1aa')).toBe(NATIONS.NORTHERN_IRELAND)
  })
})
