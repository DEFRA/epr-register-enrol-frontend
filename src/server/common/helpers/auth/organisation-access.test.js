import { describe, test, expect } from 'vitest'
import {
  getUserOrganisationIds,
  userIsRelatedToDefraOrg
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

describe('userIsRelatedToDefraOrg', () => {
  test('returns true when the linked Defra org id matches a relationship', () => {
    expect(userIsRelatedToDefraOrg(user, '50002')).toBe(true)
  })

  test('matches when the linked Defra org id is passed as a number', () => {
    expect(userIsRelatedToDefraOrg(user, 50002)).toBe(true)
  })

  test('returns false when the linked Defra org id is not in any relationship', () => {
    expect(userIsRelatedToDefraOrg(user, '99999')).toBe(false)
  })

  test('returns false for a user with no relationships', () => {
    expect(userIsRelatedToDefraOrg({}, '50001')).toBe(false)
  })

  test('returns false when the linked Defra org id is undefined (no ReEx link)', () => {
    expect(userIsRelatedToDefraOrg(user, undefined)).toBe(false)
  })

  test('returns false when the linked Defra org id is null (no ReEx link)', () => {
    expect(userIsRelatedToDefraOrg(user, null)).toBe(false)
  })
})
