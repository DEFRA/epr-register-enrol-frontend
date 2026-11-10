import { describe, test, expect } from 'vitest'

import { getTranslator } from './get-translation.js'

describe('#getTranslator', () => {
  const t = getTranslator('en')

  test('returns the translation for a key', () => {
    expect(t('pages.manageOverseasSites.heading')).toBe(
      'Manage overseas reprocessing sites'
    )
  })

  test('returns the key when there is no translation', () => {
    expect(t('pages.doesNotExist.heading')).toBe('pages.doesNotExist.heading')
  })

  test('uses the Welsh translations for cy', () => {
    expect(getTranslator('cy')('pages.manageOverseasSites.heading')).toBe(
      '[Welsh] Manage overseas reprocessing sites'
    )
  })

  test('falls back to English for an unknown locale', () => {
    expect(getTranslator('fr')('pages.manageOverseasSites.heading')).toBe(
      'Manage overseas reprocessing sites'
    )
  })

  test('fills {{var}} placeholders from the params', () => {
    expect(t('pages.manageOverseasSites.accredited.tab', { count: 3 })).toBe(
      'Accredited (3)'
    )
    expect(
      getTranslator('cy')('pages.manageOverseasSites.accredited.intro', {
        year: 2027
      })
    ).toBe(
      '[Welsh] These are your accredited overseas reprocessing sites for 2027.'
    )
  })

  test('fills a zero value', () => {
    expect(t('pages.manageOverseasSites.registered.tab', { count: 0 })).toBe(
      'Registered (0)'
    )
  })

  test('leaves placeholders untouched without params', () => {
    expect(t('pages.manageOverseasSites.accredited.tab')).toBe(
      'Accredited ({{count}})'
    )
  })

  test('leaves a placeholder untouched when its param is missing', () => {
    expect(t('pages.manageOverseasSites.accredited.tab', { year: 2027 })).toBe(
      'Accredited ({{count}})'
    )
  })

  test('ignores params that are not an object', () => {
    expect(t('pages.manageOverseasSites.accredited.tab', 2)).toBe(
      'Accredited ({{count}})'
    )
  })

  test('leaves single-brace placeholders for the pages that still use replace()', () => {
    expect(
      t('pages.selectOverseasSites.sections.accreditedCaption', { year: 2027 })
    ).toBe('These are the sites that you used in {year}.')
  })

  // docs/i18n.md pluralisation, on a key with `one` / `other` forms.
  test.each([
    [
      1,
      'Your regulator is reviewing your application to add 1 overseas reprocessing site to your accreditation. You will not be able to apply for any other changes to this site until your regulator makes their decision.'
    ],
    [
      2,
      'Your regulator is reviewing your application to add 2 overseas reprocessing sites to your accreditation. You will not be able to apply for any other changes to these sites until your regulator makes their decisions.'
    ],
    [
      0,
      'Your regulator is reviewing your application to add 0 overseas reprocessing sites to your accreditation. You will not be able to apply for any other changes to these sites until your regulator makes their decisions.'
    ]
  ])('takes the plural form for count %s', (count, expected) => {
    expect(t('pages.manageOverseasSites.pendingBanner.body', { count })).toBe(
      expected
    )
  })

  test('Welsh falls back to the other form for a category it has no key for', () => {
    expect(
      getTranslator('cy')('pages.manageOverseasSites.pendingBanner.body', {
        count: 2
      })
    ).toBe(
      '[Welsh] Your regulator is reviewing your application to add 2 overseas reprocessing sites to your accreditation. You will not be able to apply for any other changes to these sites until your regulator makes their decisions.'
    )
  })

  test('without a count, a plural key is returned unchanged', () => {
    expect(t('pages.manageOverseasSites.pendingBanner.body')).toEqual(
      expect.objectContaining({ one: expect.any(String) })
    )
  })

  test('returns non-string values unchanged', () => {
    expect(t('pages.manageOverseasSites.accredited', { count: 1 })).toEqual(
      expect.objectContaining({
        heading: 'Accredited overseas reprocessing sites'
      })
    )
  })
})
