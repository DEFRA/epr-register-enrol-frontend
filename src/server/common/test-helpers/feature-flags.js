import { vi } from 'vitest'

import { config } from '../../../config/config.js'

/**
 * Sets one feature flag for a test, leaving every other config key at its real
 * value. Returns the spy; call `mockRestore()` on it (or `vi.restoreAllMocks()`)
 * when the test is done.
 *
 * @param {string} flag - the key under `featureFlags`
 * @param {boolean} enabled
 */
export function setFeatureFlag(flag, enabled) {
  const realGet = config.get.bind(config)
  return vi
    .spyOn(config, 'get')
    .mockImplementation((key) =>
      key === `featureFlags.${flag}` ? enabled : realGet(key)
    )
}

/**
 * The flag defaults to false, so any test exercising more than one interim site
 * per ORS has to turn it on.
 *
 * @param {boolean} enabled
 */
export function setMultipleInterimSitesEnabled(enabled) {
  return setFeatureFlag('multipleInterimSitesEnabled', enabled)
}
