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

  test('returns non-string values unchanged', () => {
    expect(t('pages.manageOverseasSites.accredited', { count: 1 })).toEqual(
      expect.objectContaining({
        heading: 'Accredited overseas reprocessing sites'
      })
    )
  })
})
