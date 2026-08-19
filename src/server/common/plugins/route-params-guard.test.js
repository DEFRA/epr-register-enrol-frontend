import { describe, test, expect } from 'vitest'
import { findInvalidParam } from './route-params-guard.js'

describe('findInvalidParam', () => {
  test('returns null when there are no params', () => {
    expect(findInvalidParam(undefined)).toBeNull()
    expect(findInvalidParam({})).toBeNull()
  })

  test('ignores params with no registered schema', () => {
    expect(findInvalidParam({ someOtherParam: '../../etc/passwd' })).toBeNull()
  })

  test.each([
    ['applicationId', 'app-prns-001'],
    ['organisationId', 'org-123'],
    ['registrationId', 'REG-2026-001'],
    ['companiesHouseNo', '12345678'],
    ['siteId', '900001'],
    ['year', '2026'],
    ['language', 'en'],
    ['language', 'cy'],
    ['materialType', 'Steel'],
    ['materialType', 'Plastic']
  ])('accepts a real-world %s value', (key, value) => {
    expect(findInvalidParam({ [key]: value })).toBeNull()
  })

  test.each([
    ['applicationId', '../../etc/passwd'],
    ['applicationId', '<script>alert(1)</script>'],
    ['applicationId', 'a'.repeat(200)],
    ['siteId', 'not-a-number'],
    ['siteId', '-1'],
    ['year', 'abc'],
    ['language', 'fr'],
    ['materialType', 'Uranium']
  ])('rejects an unsafe/invalid %s value', (key, value) => {
    expect(findInvalidParam({ [key]: value })).toBe(key)
  })

  test('reports the first invalid param found', () => {
    expect(findInvalidParam({ applicationId: 'app-001', siteId: 'nope' })).toBe(
      'siteId'
    )
  })
})
