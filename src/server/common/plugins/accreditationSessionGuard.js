import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'

const ACCREDITATION_ROUTE_PREFIX = '/accreditation/'

export function shouldGuardPath(path) {
  return (
    path.startsWith(ACCREDITATION_ROUTE_PREFIX) ||
    /^\/[a-z]{2}\/accreditation\//.test(path)
  )
}

export function hasValidSession(yar) {
  return Boolean(yar.get(ACCREDITATION_SESSION_KEYS.accreditationId))
}

export const accreditationSessionGuard = {
  plugin: {
    name: 'accreditation-session-guard',
    register(server) {
      if (config.get('isTest')) {
        return
      }

      server.ext('onPreHandler', (request, h) => {
        if (!shouldGuardPath(request.path)) {
          return h.continue
        }

        if (!hasValidSession(request.yar)) {
          request.yar.flash(
            'notification',
            'Your session has expired. Please sign in again to continue.'
          )
          return h.redirect('/operator').takeover()
        }

        return h.continue
      })
    }
  }
}
