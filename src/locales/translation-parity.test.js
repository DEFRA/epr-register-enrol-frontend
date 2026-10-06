import { readFileSync } from 'node:fs'
import { describe, test, expect } from 'vitest'

const load = (language) =>
  JSON.parse(
    readFileSync(
      new URL(`./${language}/translation.json`, import.meta.url),
      'utf-8'
    )
  )

// Every dotted path to a leaf value. Arrays are leaves.
function leafKeys(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? leafKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

// Gaps that were already there when this test was added (RA-620). They are
// listed rather than fixed so the test could start guarding every NEW key
// straight away. Fixing one is welcome: the "still gaps" test below fails once
// it is closed, so the entry gets deleted instead of going stale.
const KNOWN_MISSING_IN_WELSH = [
  'pages.organisationList.description',
  'pages.operatorAccreditation.yearLabel',
  'pages.operatorAccreditation.statuses.NotStarted'
]
const KNOWN_MISSING_IN_ENGLISH = ['pages.businessPlanDetail.hint']

const english = new Set(leafKeys(load('en')))
const welsh = new Set(leafKeys(load('cy')))

const missingFrom = (have, want) => [...want].filter((key) => !have.has(key))

describe('translation files', () => {
  test('every English key has a Welsh key', () => {
    expect(
      missingFrom(welsh, english).filter(
        (key) => !KNOWN_MISSING_IN_WELSH.includes(key)
      )
    ).toEqual([])
  })

  test('every Welsh key has an English key', () => {
    expect(
      missingFrom(english, welsh).filter(
        (key) => !KNOWN_MISSING_IN_ENGLISH.includes(key)
      )
    ).toEqual([])
  })

  test('the known gaps are still gaps, so the lists above cannot go stale', () => {
    expect(missingFrom(welsh, english).sort()).toEqual(
      [...KNOWN_MISSING_IN_WELSH].sort()
    )
    expect(missingFrom(english, welsh).sort()).toEqual(
      [...KNOWN_MISSING_IN_ENGLISH].sort()
    )
  })
})
