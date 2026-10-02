import { describe, test, expect, vi, afterEach } from 'vitest'

import { accreditationApiService } from './accreditationApiService.js'
import { statusCodes } from '../constants/status-codes.js'
import { setMultipleInterimSitesEnabled } from '../test-helpers/feature-flags.js'
import {
  canAddInterimSite,
  isMultipleInterimSitesEnabled,
  siteCanTakeInterimSite,
  InterimSiteLimitError
} from './interimSiteLimit.js'

const ACTIVE = { siteId: 42, siteName: 'Live Depot' }
const WITHDRAWN = {
  siteId: 43,
  siteName: 'Old Depot',
  removedAt: '2026-09-01T00:00:00Z'
}

function application(sites) {
  return { overseasSites: { sites } }
}

describe('interimSiteLimit', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('the flag defaults to off', () => {
    expect(isMultipleInterimSitesEnabled()).toBe(false)
  })

  describe('canAddInterimSite', () => {
    test.each([
      ['no interim sites', {}, true],
      ['only a withdrawn one', { interimSites: [WITHDRAWN] }, true],
      ['an active one in the list', { interimSites: [ACTIVE] }, false],
      ['an active legacy singular one', { interimSite: ACTIVE }, false]
    ])('with the flag off, an ORS with %s -> %s', (_, site, expected) => {
      setMultipleInterimSitesEnabled(false)
      expect(canAddInterimSite(site)).toBe(expected)
    })

    test('with the flag on, an ORS that already has several may take more', () => {
      setMultipleInterimSitesEnabled(true)
      expect(
        canAddInterimSite({ interimSites: [ACTIVE, { ...ACTIVE, siteId: 44 }] })
      ).toBe(true)
    })
  })

  describe('siteCanTakeInterimSite', () => {
    const params = {
      organisationId: 'org-1',
      applicationId: 'app-1',
      siteId: 900001
    }

    test('with the flag on, answers without reading the application', async () => {
      setMultipleInterimSitesEnabled(true)
      const spy = vi.spyOn(accreditationApiService, 'getApplication')

      await expect(siteCanTakeInterimSite(params)).resolves.toBe(true)
      expect(spy).not.toHaveBeenCalled()
    })

    test('with the flag off, refuses an ORS that already has an active interim site', async () => {
      setMultipleInterimSitesEnabled(false)
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        application([{ siteId: 900001, interimSites: [ACTIVE] }])
      )

      await expect(siteCanTakeInterimSite(params)).resolves.toBe(false)
    })

    test('with the flag off, allows an ORS with none', async () => {
      setMultipleInterimSitesEnabled(false)
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        application([{ siteId: 900001, interimSites: [WITHDRAWN] }])
      )

      await expect(siteCanTakeInterimSite(params)).resolves.toBe(true)
    })

    // Not this check's call: the write it guards fails on its own terms.
    test('allows an ORS that is not on the application', async () => {
      setMultipleInterimSitesEnabled(false)
      vi.spyOn(accreditationApiService, 'getApplication').mockResolvedValue(
        application([])
      )

      await expect(siteCanTakeInterimSite(params)).resolves.toBe(true)
    })
  })

  test('InterimSiteLimitError carries a 409 so it takes the conflict path', () => {
    const err = new InterimSiteLimitError(900001)
    expect(err.status).toBe(statusCodes.conflict)
    expect(err.name).toBe('InterimSiteLimitError')
    expect(err.message).toContain('900001')
  })
})
