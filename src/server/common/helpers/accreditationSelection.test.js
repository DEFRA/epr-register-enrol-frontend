import { describe, test, expect } from 'vitest'
import { selectApplicationForYear } from './accreditationSelection.js'

const REGISTRATION_ID = 'REG001'
const MATERIAL = 'Steel'
const YEAR = 2026

const makeApp = (overrides = {}) => ({
  applicationId: 'app-id-001',
  applicationStatus: 'Saved',
  materialType: MATERIAL,
  registrationId: REGISTRATION_ID,
  year: YEAR,
  ...overrides
})

// RA-357: a year can now hold a withdrawn record alongside its live
// replacement, and the backend gives no ordering guarantee on the list
// response, so selection must never depend on array order.
describe('#selectApplicationForYear', () => {
  const criteria = {
    registrationId: REGISTRATION_ID,
    materialType: MATERIAL,
    year: YEAR
  }

  const withdrawn = (overrides = {}) =>
    makeApp({ applicationStatus: 'Withdrawn', ...overrides })

  test('returns nothing for an empty list', () => {
    expect(selectApplicationForYear([], criteria)).toEqual({
      application: null,
      hasLive: false,
      hasMatch: false
    })
  })

  test('ignores applications for another registration, material or year', () => {
    const result = selectApplicationForYear(
      [
        makeApp({ registrationId: 'REG999' }),
        makeApp({ materialType: 'Glass' }),
        makeApp({ year: YEAR - 1 })
      ],
      criteria
    )

    expect(result).toEqual({
      application: null,
      hasLive: false,
      hasMatch: false
    })
  })

  test('returns the only matching application', () => {
    const app = makeApp()

    expect(selectApplicationForYear([app], criteria)).toEqual({
      application: app,
      hasLive: true,
      hasMatch: true
    })
  })

  test.each([
    ['withdrawn first', true],
    ['live first', false]
  ])(
    'prefers the live application over a withdrawn one (%s)',
    (_label, withdrawnFirst) => {
      const dead = withdrawn({ applicationId: 'app-withdrawn' })
      const alive = makeApp({ applicationId: 'app-live' })
      const list = withdrawnFirst ? [dead, alive] : [alive, dead]

      const result = selectApplicationForYear(list, criteria)

      expect(result.application).toBe(alive)
      expect(result.hasLive).toBe(true)
      expect(result.hasMatch).toBe(true)
    }
  )

  test('falls back to the withdrawn application when that is all there is', () => {
    const dead = withdrawn({ applicationId: 'app-withdrawn' })

    expect(selectApplicationForYear([dead], criteria)).toEqual({
      application: dead,
      hasLive: false,
      hasMatch: true
    })
  })

  test.each([
    ['newest last', false],
    ['newest first', true]
  ])(
    'picks the live application with the newest createdAt (%s)',
    (_label, newestFirst) => {
      const older = makeApp({
        applicationId: 'app-older',
        createdAt: '2026-01-01T00:00:00.000Z'
      })
      const newer = makeApp({
        applicationId: 'app-newer',
        createdAt: '2026-06-01T00:00:00.000Z'
      })
      const list = newestFirst ? [newer, older] : [older, newer]

      expect(selectApplicationForYear(list, criteria).application).toBe(newer)
    }
  )

  test('prefers a record carrying a createdAt over one without', () => {
    const undated = makeApp({ applicationId: 'app-zzz-undated' })
    const dated = makeApp({
      applicationId: 'app-aaa-dated',
      createdAt: '2026-01-01T00:00:00.000Z'
    })

    expect(
      selectApplicationForYear([undated, dated], criteria).application
    ).toBe(dated)
    expect(
      selectApplicationForYear([dated, undated], criteria).application
    ).toBe(dated)
  })

  test.each([
    ['identical createdAt', '2026-01-01T00:00:00.000Z'],
    ['no createdAt at all', undefined]
  ])('breaks a tie on the highest applicationId (%s)', (_label, createdAt) => {
    const lower = makeApp({ applicationId: 'app-001', createdAt })
    const higher = makeApp({ applicationId: 'app-002', createdAt })

    expect(
      selectApplicationForYear([lower, higher], criteria).application
    ).toBe(higher)
    expect(
      selectApplicationForYear([higher, lower], criteria).application
    ).toBe(higher)
  })
})
