import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { getMissingRequiredConfig } from './required-config.js'

/**
 * Readiness check — reports missing required config (key names only, never values)
 * as 503, separate from /health (which must stay a trivial always-up liveness check
 * the platform polls). See required-config.js for why this exists (RA-441).
 */
export const readyController = {
  handler(_request, h) {
    const missing = getMissingRequiredConfig(config)

    if (missing.length === 0) {
      return h.response({ status: 'healthy' }).code(statusCodes.ok)
    }

    return h
      .response({ status: 'unhealthy', missing })
      .code(statusCodes.serviceUnavailable)
  }
}
