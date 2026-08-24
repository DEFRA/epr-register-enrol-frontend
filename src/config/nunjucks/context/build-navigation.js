import { ACCREDITATION_SESSION_KEYS } from '../../../server/common/constants/accreditationSessionKeys.js'
import {
  landingUrl,
  FALLBACK_HOME_HREF
} from '../../../server/common/helpers/accreditationUrls.js'

// Pages with no application context to deep-link to: the stub login chooser
// (no user yet), the WIP operator testing page, and the bare
// operator-accreditation path with no application selected.
function isPreContextPath(path) {
  return (
    path === '/operator' ||
    path === '/operator-accreditation' ||
    path === '/operator-accreditation/' ||
    (typeof path === 'string' && path.startsWith('/auth/stub'))
  )
}

// request.yar is only initialized during hapi's onPreAuth phase, which is
// skipped entirely for a request that never matched a route (404s go
// straight from onRequest to onPreResponse) — so yar.get() throws rather
// than returning undefined on those error-page renders. Read defensively.
function readAccreditationSession(yar) {
  try {
    return {
      organisationId: yar?.get(ACCREDITATION_SESSION_KEYS.organisationId),
      registrationId: yar?.get(ACCREDITATION_SESSION_KEYS.registrationId),
      materialType: yar?.get(ACCREDITATION_SESSION_KEYS.materialType),
      year: yar?.get(ACCREDITATION_SESSION_KEYS.year)
    }
  } catch {
    return {}
  }
}

// Home points at the operator's landing status page for whichever
// application they last visited, so it always returns them to where they
// left off rather than the generic operator selection page.
function resolveHomeHref(request) {
  if (isPreContextPath(request?.path)) {
    return FALLBACK_HOME_HREF
  }

  const { organisationId, registrationId, materialType, year } =
    readAccreditationSession(request?.yar)

  if (!organisationId || !registrationId || !materialType || !year) {
    return FALLBACK_HOME_HREF
  }

  return landingUrl({ organisationId, registrationId, materialType, year })
}

export function buildNavigation(request) {
  const homeHref = resolveHomeHref(request)
  return [
    {
      text: 'Home',
      href: homeHref,
      current: request?.path === homeHref
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]
}
