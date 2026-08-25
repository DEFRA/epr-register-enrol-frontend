import { config } from '../../../../config/config.js'

/**
 * RA-427: kill switch for the regulator side of the app while no
 * regulator-facing features are built out yet.
 */
export function isRegulatorAccessDisabled() {
  return config.get('auth.regulatorAccessDisabled')
}
