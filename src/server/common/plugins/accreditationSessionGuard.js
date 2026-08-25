import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { operatorCanAccessOrganisation } from '../helpers/reex-organisation-service.js'
import { accreditationApiService } from '../helpers/accreditationApiService.js'
import { landingUrl } from '../helpers/accreditationUrls.js'
import { getLocaleAndTranslator } from '../helpers/get-locale-translator.js'
import { buildApplicationHeaderViewModel } from '../helpers/applicationHeader.js'
import {
  TERMINAL_STATUSES,
  LOCKED_STATUSES
} from '../helpers/accreditationSelection.js'

const ACCREDITATION_ROUTE_PREFIX = '/accreditation/'

export function shouldGuardPath(path) {
  return (
    path.startsWith(ACCREDITATION_ROUTE_PREFIX) ||
    /^\/[a-z]{2}\/accreditation\//.test(path)
  )
}

// Routes that are safe to reach on a terminal (Withdrawn/Approved/Rejected)
// application — the withdraw confirmation page has its own status guard, and
// payment details are read-only by nature. Everything else under
// /accreditation/ is a form that edits application data, so it must not be
// reachable once the application is in a terminal state (AC09, RA-415).
const READ_ONLY_SAFE_SEGMENTS = new Set([
  'withdraw-application',
  'view-payment-details'
])

function routeSegment(path) {
  return path.match(/^\/(?:[a-z]{2}\/)?accreditation\/([^/]+)\//)?.[1] ?? null
}

export function isEditRestrictedPath(path) {
  const segment = routeSegment(path)
  if (!segment) {
    return false
  }
  return !READ_ONLY_SAFE_SEGMENTS.has(segment)
}

// RA-481: maps an /accreditation/<segment>/ route prefix to the application
// field holding that section's own sectionStatus, so a POST/save request can
// be checked against the locked-status rule without this plugin needing to
// know each page's own logic. Every routeSegment() that edits one of the
// five accreditation sections is listed here (including its CYA/detail/
// upload sub-pages and the add-overseas-site/add-interim-site wizards, which
// all ultimately write into overseasSites or besEvidence); routes that
// aren't a single section's editor (task-list, submit-declaration,
// query-declaration, withdraw-application, view-payment-details) are left
// out on purpose and rely on their own controller-level checks instead.
const SECTION_STATUS_FIELD_BY_ROUTE_SEGMENT = {
  tonnage: 'prns',
  'tonnage-authority': 'prns',
  'tonnage-cya': 'prns',
  'business-plan': 'businessPlan',
  'business-plan-detail': 'businessPlan',
  'business-plan-cya': 'businessPlan',
  'sampling-plan': 'samplingPlan',
  'select-overseas-sites': 'overseasSites',
  'confirm-overseas-sites': 'overseasSites',
  'add-overseas-site': 'overseasSites',
  'add-interim-site': 'overseasSites',
  'upload-evidence-for-overseas-site': 'besEvidence',
  'cya-evidence-for-overseas-site': 'besEvidence',
  'check-site-conditions': 'besEvidence',
  'upload-bes-evidence': 'besEvidence',
  'upload-more-evidence': 'besEvidence'
}

// RA-481 defence in depth: true when a POST/save to this locked-but-not-
// terminal application must be refused because the section it targets isn't
// the one currently Queried. Unlike TERMINAL_STATUSES, a locked application
// must still render normally on GET (the controller renders read-only via
// resolveQueriedSectionAccess) — this only ever blocks a write.
export function isLockedSectionWrite(request, application) {
  if (
    request.method !== 'post' ||
    !application ||
    !LOCKED_STATUSES.has(application.applicationStatus)
  ) {
    return false
  }
  const sectionField =
    SECTION_STATUS_FIELD_BY_ROUTE_SEGMENT[routeSegment(request.path)]
  if (!sectionField) {
    return false
  }
  return application[sectionField]?.sectionStatus !== 'Queried'
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
//
// Resolved from the route's own applicationId, not the session's — every
// accreditation page fetches and renders by request.params.applicationId,
// and the session value is only set once by the landing controllers, so it
// can point at a different application than the one on screen (a second
// tab, back button, or bookmark to an earlier application). Falls back to
// the session value only when the route has none.
export async function fetchApplication(yar, routeApplicationId) {
  const applicationId =
    routeApplicationId ?? yar.get(ACCREDITATION_SESSION_KEYS.accreditationId)
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

        const application = await fetchApplication(
          request.yar,
          request.params?.applicationId
        )

        if (
          isEditRestrictedPath(request.path) &&
          TERMINAL_STATUSES.has(application?.applicationStatus)
        ) {
          return h.redirect(landingUrl(application)).takeover()
        }

        if (
          isEditRestrictedPath(request.path) &&
          isLockedSectionWrite(request, application)
        ) {
          return h.redirect(request.path).takeover()
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
