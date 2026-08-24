import Hapi from '@hapi/hapi'
import { describe, test, expect } from 'vitest'
import {
  findInvalidParam,
  normaliseParams,
  routeParamsGuard
} from './route-params-guard.js'

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
    // E2E/test tooling seeds disposable accreditation years thousands of
    // years in the future to dodge Mongo-persisted-between-runs collisions.
    ['year', '3347'],
    ['year', '4520'],
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

  // The Re-Ex frontend links here with lowercase material slugs (e.g.
  // "paper"), matching the backend's own material field casing rather than
  // this app's capitalised MATERIAL_TYPES form.
  test.each([
    ['materialType', 'paper'],
    ['materialType', 'STEEL']
  ])('accepts a differently-cased %s value', (key, value) => {
    expect(findInvalidParam({ [key]: value })).toBeNull()
  })
})

describe('normaliseParams', () => {
  test('rewrites materialType to its canonical case in place', () => {
    const params = { materialType: 'paper' }
    normaliseParams(params)
    expect(params.materialType).toBe('Paper')
  })

  test('leaves already-canonical and unregistered params untouched', () => {
    const params = { materialType: 'Steel', someOtherParam: 'unchanged' }
    normaliseParams(params)
    expect(params).toEqual({
      materialType: 'Steel',
      someOtherParam: 'unchanged'
    })
  })

  // siteId/year have Joi.number() schemas (needed so findInvalidParam can
  // reject non-numeric values), but normaliseParams must not write their
  // coerced-to-number value back — every current consumer expects the raw
  // string param, and this guard has no route-scoped reason to change that
  // app-wide.
  test('does not coerce siteId/year to numbers', () => {
    const params = { siteId: '900001', year: '2026' }
    normaliseParams(params)
    expect(params).toEqual({ siteId: '900001', year: '2026' })
    expect(typeof params.siteId).toBe('string')
    expect(typeof params.year).toBe('string')
  })

  test('does not throw when params is undefined', () => {
    expect(() => normaliseParams(undefined)).not.toThrow()
  })
})

describe('routeParamsGuard plugin', () => {
  async function makeServer() {
    const server = Hapi.server()
    await server.register(routeParamsGuard)
    server.route({
      method: 'GET',
      path: '/test/{siteId}/{materialType}',
      handler: (request) => request.params
    })
    await server.initialize()
    return server
  }

  test('rejects an invalid param with a 400 before the handler runs', async () => {
    const server = await makeServer()

    const { statusCode } = await server.inject('/test/not-a-number/Steel')

    expect(statusCode).toBe(400)
    await server.stop({ timeout: 0 })
  })

  test('normalises materialType casing but leaves siteId as the raw string', async () => {
    const server = await makeServer()

    const { statusCode, result } = await server.inject('/test/900001/steel')

    expect(statusCode).toBe(200)
    expect(result).toEqual({ siteId: '900001', materialType: 'Steel' })
    await server.stop({ timeout: 0 })
  })
})
