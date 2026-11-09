import { describe, test, expect } from 'vitest'

import { isItemForSite } from './changeRequestSite.js'

describe('isItemForSite', () => {
  const site = { siteId: 901807, orsId: '004' }

  test('matches by ORS id when the item and the site both have one', () => {
    expect(isItemForSite({ siteId: 4, orsId: '004' }, site)).toBe(true)
    expect(isItemForSite({ siteId: 901807, orsId: '003' }, site)).toBe(false)
  })

  test('falls back to the site id when either has no ORS id', () => {
    expect(isItemForSite({ siteId: '901807' }, site)).toBe(true)
    expect(isItemForSite({ siteId: 4 }, site)).toBe(false)
    expect(isItemForSite({ siteId: 4, orsId: '004' }, { siteId: 4 })).toBe(true)
  })
})
