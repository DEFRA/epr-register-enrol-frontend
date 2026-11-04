import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { createServer } from '../../server.js'
import { operatorCanAccessOrganisation } from '../helpers/reex-organisation-service.js'
import { setFeatureFlag } from './feature-flags.js'
import { MANAGE_CURRENT_YEAR, MANAGE_ORG_ID } from './manage-api.js'

/**
 * Registers the hooks every /manage page test needs, inside the calling
 * describe block. The clock is pinned mid-MANAGE_CURRENT_YEAR because the
 * pages pick the accreditation for the current calendar year.
 *
 * The test file must `vi.mock` reex-organisation-service.js with
 * `operatorCanAccessOrganisation: vi.fn()`: vi.mock is only hoisted in test
 * files, so it can't live here.
 */
export function setupManagePageServer() {
  let flag
  const page = {
    server: null,
    get: (url) => page.server.inject({ method: 'GET', url }),
    setInYearChangesEnabled(enabled) {
      // Re-spying an already-spied config.get would wrap the spy itself.
      flag?.mockRestore()
      flag = setFeatureFlag('inYearChangesEnabled', enabled)
    }
  }

  beforeAll(async () => {
    page.server = await createServer()
    await page.server.initialize()
  })

  afterAll(async () => {
    await page.server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${MANAGE_CURRENT_YEAR}-06-15T12:00:00Z`))
    page.setInYearChangesEnabled(true)
    operatorCanAccessOrganisation.mockImplementation(
      async (_user, orgId) => orgId === MANAGE_ORG_ID
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    flag?.mockRestore()
    flag = undefined
  })

  return page
}
