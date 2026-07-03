import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { userCanAccessOrganisation } from '../helpers/auth/organisation-access.js'

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

// Defence in depth: the session organisation id was validated against the
// operator's Defra ID relationships when the accreditation was entered, but we
// re-check it on every downstream accreditation request so a tampered or shared
// session cannot be used to act on an organisation the user is not related to.
// Absent org id means nothing to enforce here — the entry controller guards
// initial access.
export function hasOrganisationAccess(yar, user) {
  const organisationId = yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
  if (!organisationId) {
    return true
  }
  return userCanAccessOrganisation(user, organisationId)
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

        if (!hasOrganisationAccess(request.yar, request.auth?.credentials)) {
          throw Boom.forbidden('You do not have access to this organisation')
        }

        return h.continue
      })
    }
  }
}
