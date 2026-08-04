import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { operatorCanAccessOrganisation } from '../helpers/reex-organisation-service.js'
import { accreditationApiService } from '../helpers/accreditationApiService.js'
import { landingUrl } from '../helpers/accreditationUrls.js'
import { getLocaleAndTranslator } from '../helpers/get-locale-translator.js'
import { buildApplicationHeaderViewModel } from '../helpers/applicationHeader.js'

const ACCREDITATION_ROUTE_PREFIX = '/accreditation/'

export function shouldGuardPath(path) {
  return (
    path.startsWith(ACCREDITATION_ROUTE_PREFIX) ||
    /^\/[a-z]{2}\/accreditation\//.test(path)
  )
}

// Routes that are safe to reach on a Withdrawn application — the withdraw
// confirmation page has its own status guard, and payment details are
// read-only by nature. Everything else under /accreditation/ is a form that
// edits application data, so it must not be reachable once withdrawn (AC09).
const READ_ONLY_SAFE_SEGMENTS = new Set([
  'withdraw-application',
  'view-payment-details'
])

export function isWithdrawnBlockedPath(path) {
  const match = path.match(/^\/(?:[a-z]{2}\/)?accreditation\/([^/]+)\//)
  if (!match) {
    return false
  }
  return !READ_ONLY_SAFE_SEGMENTS.has(match[1])
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
export async function hasOrganisationAccess(yar, user, logger) {
  const organisationId = yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
  if (!organisationId) {
    return true
  }
  return operatorCanAccessOrganisation(user, organisationId, { logger })
}

// Single fetch shared by the Withdrawn check (AC09) and the persistent
// application-header population below. Fails open on a fetch error — a
// transient backend outage should not block navigation, since the backend's
// own write-side guard is what actually protects the data, and the header
// simply won't render.
export async function fetchApplication(yar) {
  const applicationId = yar.get(ACCREDITATION_SESSION_KEYS.accreditationId)
  const organisationId = yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
  if (!applicationId || !organisationId) {
    return null
  }
  return accreditationApiService
    .getApplication(organisationId, applicationId)
    .catch(() => null)
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
          request.auth?.credentials,
          request.logger
        )
        if (!allowed) {
          throw Boom.forbidden('You do not have access to this organisation')
        }

        const application = await fetchApplication(request.yar)

        if (
          isWithdrawnBlockedPath(request.path) &&
          application?.applicationStatus === 'Withdrawn'
        ) {
          return h
            .redirect(landingUrl(application, application.isExporter))
            .takeover()
        }

        if (application) {
          const { t } = getLocaleAndTranslator(request)
          request.app = request.app ?? {}
          request.app.applicationHeader = buildApplicationHeaderViewModel(
            application,
            t
          )
        }

        return h.continue
      })
    }
  }
}
