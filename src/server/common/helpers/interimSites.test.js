import { describe, test, expect } from 'vitest'
import {
  allInterimSites,
  activeInterimSites,
  withdrawnInterimSites,
  findInterimSite
} from './interimSites.js'

const interim = (siteId, overrides = {}) => ({
  siteId,
  siteNumber: `SN-${String(siteId).padStart(4, '0')}`,
  siteName: `Interim ${siteId}`,
  country: 'France',
  operationCodes: ['R12'],
  ...overrides
})

const WITHDRAWN_AT = '2026-08-14T09:30:00.000Z'

describe('allInterimSites', () => {
  test('returns the list when the site has one', () => {
    const site = { interimSites: [interim(42), interim(43)] }

    expect(allInterimSites(site).map((i) => i.siteId)).toEqual([42, 43])
  })

  // A document written before RA-603, or one the API has not caught up on,
  // carries only the singular field.
  test('falls back to the legacy singular field', () => {
    expect(allInterimSites({ interimSite: interim(42) })[0].siteId).toBe(42)
  })

  // The singular field is a mirror the backend maintains, so it can lag the
  // list. Reading it in preference would be a downgrade, not a fallback.
  test('prefers the list over the singular field when both are present', () => {
    const site = { interimSite: interim(1), interimSites: [interim(42)] }

    expect(allInterimSites(site).map((i) => i.siteId)).toEqual([42])
  })

  test('includes withdrawn interim sites', () => {
    const site = {
      interimSites: [interim(42, { removedAt: WITHDRAWN_AT }), interim(43)]
    }

    expect(allInterimSites(site)).toHaveLength(2)
  })

  test('is empty for a site with no interim sites, and for no site at all', () => {
    expect(allInterimSites({})).toEqual([])
    expect(allInterimSites(null)).toEqual([])
    expect(allInterimSites(undefined)).toEqual([])
  })

  test('does not mutate the site', () => {
    const site = { interimSite: interim(42) }

    allInterimSites(site)

    expect(site.interimSites).toBeUndefined()
  })
})

describe('activeInterimSites', () => {
  test('leaves out anything withdrawn', () => {
    const site = {
      interimSites: [
        interim(42),
        interim(43, { removedAt: WITHDRAWN_AT }),
        interim(44)
      ]
    }

    expect(activeInterimSites(site).map((i) => i.siteId)).toEqual([42, 44])
  })

  test('is empty when every interim site is withdrawn', () => {
    const site = { interimSites: [interim(42, { removedAt: WITHDRAWN_AT })] }

    expect(activeInterimSites(site)).toEqual([])
  })

  // A legacy document has no removedAt anywhere, so everything in it is active.
  test('treats a legacy singular interim site as active', () => {
    expect(activeInterimSites({ interimSite: interim(42) })).toHaveLength(1)
  })
})

describe('withdrawnInterimSites', () => {
  test('returns only what has been withdrawn', () => {
    const site = {
      interimSites: [interim(42), interim(43, { removedAt: WITHDRAWN_AT })]
    }

    expect(withdrawnInterimSites(site).map((i) => i.siteId)).toEqual([43])
  })

  test('is empty when nothing has been withdrawn', () => {
    expect(withdrawnInterimSites({ interimSites: [interim(42)] })).toEqual([])
  })
})

describe('findInterimSite', () => {
  const sites = [
    { siteId: 1, siteName: 'ORS one', interimSites: [interim(42)] },
    { siteId: 2, siteName: 'ORS two', interimSites: [interim(43), interim(44)] }
  ]

  // The whole reason the routes can take a single id: interim site ids are
  // unique application-wide, so the parent can be derived rather than passed.
  test('finds an interim site by its own id and reports its parent ORS', () => {
    const found = findInterimSite(sites, 44)

    expect(found.interimSite.siteId).toBe(44)
    expect(found.site.siteId).toBe(2)
  })

  test('finds a withdrawn interim site too, so it can be restored', () => {
    const withWithdrawn = [
      { siteId: 1, interimSites: [interim(42, { removedAt: WITHDRAWN_AT })] }
    ]

    expect(findInterimSite(withWithdrawn, 42).interimSite.removedAt).toBe(
      WITHDRAWN_AT
    )
  })

  test('finds one held only in the legacy singular field', () => {
    const legacy = [{ siteId: 1, interimSite: interim(42) }]

    expect(findInterimSite(legacy, 42).site.siteId).toBe(1)
  })

  test('returns null for an unknown id, an empty list and no list', () => {
    expect(findInterimSite(sites, 999)).toBeNull()
    expect(findInterimSite([], 42)).toBeNull()
    expect(findInterimSite(undefined, 42)).toBeNull()
  })

  // An ORS id and an interim site id come from the same sequence, so they can
  // never collide - but the lookup must not match an ORS by mistake either.
  test('does not match an overseas site id', () => {
    expect(findInterimSite(sites, 1)).toBeNull()
  })
})
