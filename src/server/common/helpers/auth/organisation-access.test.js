import { describe, test, expect } from 'vitest'
import {
  getUserOrganisationIds,
  userCanAccessOrganisation
} from './organisation-access.js'

const user = {
  currentRelationshipId: 'rel-1',
  relationships: [
    'rel-1:50001:First Org',
    'rel-2:50002:Second Org',
    'rel-3:50003:Third Org'
  ]
}

describe('getUserOrganisationIds', () => {
  test('extracts organisation ids from relationship strings', () => {
    expect(getUserOrganisationIds(user)).toEqual(['50001', '50002', '50003'])
  })

  test('returns empty array when user has no relationships', () => {
    expect(getUserOrganisationIds({})).toEqual([])
  })

  test('returns empty array for null user', () => {
    expect(getUserOrganisationIds(null)).toEqual([])
  })

  test('ignores malformed entries missing an organisation id', () => {
    expect(
      getUserOrganisationIds({ relationships: ['rel-only', 'rel-x:50009:Org'] })
    ).toEqual(['50009'])
  })

  test('ignores non-string relationship entries', () => {
    expect(
      getUserOrganisationIds({ relationships: [{ orgId: '50001' }, null] })
    ).toEqual([])
  })
})

describe('userCanAccessOrganisation', () => {
  test('returns true when the org id matches a relationship', () => {
    expect(userCanAccessOrganisation(user, '50002')).toBe(true)
  })

  test('matches when the org id is passed as a number', () => {
    expect(userCanAccessOrganisation(user, 50002)).toBe(true)
  })

  test('returns false when the org id is not in any relationship', () => {
    expect(userCanAccessOrganisation(user, '99999')).toBe(false)
  })

  test('returns false for a user with no relationships', () => {
    expect(userCanAccessOrganisation({}, '50001')).toBe(false)
  })

  test('returns false when organisationId is undefined', () => {
    expect(userCanAccessOrganisation(user, undefined)).toBe(false)
  })

  test('returns false when organisationId is null', () => {
    expect(userCanAccessOrganisation(user, null)).toBe(false)
  })
})
