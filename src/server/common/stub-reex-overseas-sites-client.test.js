import { describe, test, expect, vi } from 'vitest'

const OVERSEAS_SITES_URL = (orgId, regId = 'reg001', accId = 'acc001') =>
  `/v1/organisations/${orgId}/registrations/${regId}/accreditations/${accId}/overseas-sites`

async function freshStub() {
  vi.resetModules()
  const m = await import('./stub-reex-overseas-sites-client.js')
  return m.stubReexOverseasSitesClient
}

describe('stubReexOverseasSitesClient.get', () => {
  test('returns a keyed dictionary for a known orgId', async () => {
    const stub = await freshStub()
    const result = await stub.get(OVERSEAS_SITES_URL('50004'))
    expect(typeof result).toBe('object')
    expect(Object.keys(result).length).toBeGreaterThan(0)
  })

  test('returns {} for an unknown orgId', async () => {
    const stub = await freshStub()
    const result = await stub.get(OVERSEAS_SITES_URL('99999'))
    expect(result).toEqual({})
  })

  test('returns {} for a non-matching URL', async () => {
    const stub = await freshStub()
    const result = await stub.get('/some/other/endpoint')
    expect(result).toEqual({})
  })

  test('each site entry has the required ReEx schema fields', async () => {
    const stub = await freshStub()
    const result = await stub.get(OVERSEAS_SITES_URL('50006'))
    for (const site of Object.values(result)) {
      expect(site).toHaveProperty('name')
      expect(site).toHaveProperty('country')
      expect(site).toHaveProperty('address')
      expect(site.address).toHaveProperty('line1')
      expect(site.address).toHaveProperty('townOrCity')
      expect(site).toHaveProperty('coordinates')
      expect(site).toHaveProperty('validFrom')
    }
  })

  test('returns all three sites for org 50006', async () => {
    const stub = await freshStub()
    const result = await stub.get(OVERSEAS_SITES_URL('50006'))
    expect(Object.keys(result)).toHaveLength(3)
  })

  test('returns single site for org 50003', async () => {
    const stub = await freshStub()
    const result = await stub.get(OVERSEAS_SITES_URL('50003'))
    expect(Object.keys(result)).toHaveLength(1)
  })

  test('result is consistent regardless of registrationId and accreditationId', async () => {
    const stub = await freshStub()
    const r1 = await stub.get(OVERSEAS_SITES_URL('50004', 'reg-A', 'acc-X'))
    const r2 = await stub.get(OVERSEAS_SITES_URL('50004', 'reg-B', 'acc-Y'))
    expect(r1).toEqual(r2)
  })
})

describe('reexOverseasSitesClient toggle', () => {
  test('is the stub when api.stubEnabled is true', async () => {
    vi.resetModules()
    vi.doMock('../../config/config.js', () => ({
      config: { get: (key) => (key === 'api.stubEnabled' ? true : undefined) }
    }))
    vi.doMock('./api-client.js', () => ({
      createApiClient: () => ({ get: vi.fn() })
    }))
    const { reexOverseasSitesClient, stubReexOverseasSitesClient } =
      await import('./stub-reex-overseas-sites-client.js')
    expect(reexOverseasSitesClient).toBe(stubReexOverseasSitesClient)
    vi.doUnmock('../../config/config.js')
    vi.doUnmock('./api-client.js')
  })

  test('is not the stub when api.stubEnabled is false', async () => {
    vi.resetModules()
    vi.doMock('../../config/config.js', () => ({
      config: { get: () => false }
    }))
    vi.doMock('./api-client.js', () => ({
      createApiClient: () => ({ get: vi.fn() })
    }))
    const { reexOverseasSitesClient, stubReexOverseasSitesClient } =
      await import('./stub-reex-overseas-sites-client.js')
    expect(reexOverseasSitesClient).not.toBe(stubReexOverseasSitesClient)
    vi.doUnmock('../../config/config.js')
    vi.doUnmock('./api-client.js')
  })
})
