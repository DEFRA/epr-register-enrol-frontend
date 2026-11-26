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
    expect(
      t('common.pagination.showing', { start: 1, end: 10, total: 12 })
    ).toBe('Showing 1-10 of 12')
    expect(getTranslator('cy')('common.pagination.page', { number: 2 })).toBe(
      '[Welsh] Page 2'
    )
  })

  test('fills a zero value', () => {
    expect(t('common.pagination.page', { number: 0 })).toBe('Page 0')
  })

  test('leaves placeholders untouched without params', () => {
    expect(t('common.pagination.page')).toBe('Page {{number}}')
  })

  test('leaves a placeholder untouched when its param is missing', () => {
    expect(t('common.pagination.page', { year: 2027 })).toBe('Page {{number}}')
  })

  test('ignores params that are not an object', () => {
    expect(t('common.pagination.page', 2)).toBe('Page {{number}}')
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
    expect(t('pages.manageOverseasSites.table', { count: 1 })).toEqual(
      expect.objectContaining({ siteName: 'Site name' })
    )
  })
})
