import { describe, expect, test } from 'vitest'

import { changeRequestsSummary, findRequestSite } from './view-model.js'

describe('findRequestSite', () => {
  const view = (sites, requestSites) => ({
    sites,
    activeRequest: { sites: requestSites }
  })

  test('finds the request site by the site key', () => {
    const item = { siteId: 901807 }
    expect(findRequestSite(view([], [item]), '901807')).toBe(item)
  })

  // RA-697: as isItemForSite, a registration-only item's siteId is its ORS
  // id's integer value, not the accreditation's key for the ORS.
  test('matches by ORS id when the item and the site both have one', () => {
    const item = { siteId: 4, orsId: '004' }
    const sites = [
      { siteId: 901807, orsId: '004' },
      { siteId: 4, orsId: '003' }
    ]
    expect(findRequestSite(view(sites, [item]), 901807)).toBe(item)
    expect(findRequestSite(view(sites, [item]), 4)).toBeUndefined()
  })

  test('finds nothing with no draft', () => {
    expect(findRequestSite({ sites: [], activeRequest: null }, 1)).toBe(
      undefined
    )
  })
})

describe('changeRequestsSummary', () => {
  test('copes with a view with no sites list', () => {
    const summary = changeRequestsSummary({ activeRequest: null })
    expect(summary.pendingRequestStatus(1)).toBeNull()
    expect(summary.isInDraftRequest(1)).toBe(false)
    expect(summary.readyForSubmissionCount).toBe(0)
  })
})
