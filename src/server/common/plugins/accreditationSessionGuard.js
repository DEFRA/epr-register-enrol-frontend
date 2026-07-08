import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { userIsRelatedToDefraOrg } from '../helpers/auth/organisation-access.js'
import { getLinkedDefraOrganisationId } from '../helpers/reex-organisation-service.js'

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
// The URL/session org id is a ReEx-internal id, so we resolve its linked Defra
// organisation id (cached) before comparing against the operator's relationships.
// Absent org id means nothing to enforce here — the entry controller guards
// initial access.
export async function hasOrganisationAccess(yar, user) {
  const organisationId = yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
  if (!organisationId) {
    return true
  }
  const linkedDefraOrganisationId =
    await getLinkedDefraOrganisationId(organisationId)
  return userIsRelatedToDefraOrg(user, linkedDefraOrganisationId)
}

export const accreditationSessionGuard = {
  plugin: {
    name: 'accreditation-session-guard',
    register(server) {
      if (config.get('isTest')) {
        return
      }

      server.ext('onPreHandler', async (request, h) => {
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

        const allowed = await hasOrganisationAccess(
          request.yar,
          request.auth?.credentials
        )
        if (!allowed) {
          throw Boom.forbidden('You do not have access to this organisation')
        }

        return h.continue
      })
    }
  }
}
