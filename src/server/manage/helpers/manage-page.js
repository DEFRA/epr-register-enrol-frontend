import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { composeApplicationCaption } from '../../common/helpers/applicationHeader.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { localePrefix } from '../../common/helpers/localePrefix.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { fetchCurrentAccreditation } from './current-accreditation.js'
import { fetchApprovedRegistration } from './current-registration.js'

// Runs before auth, so a logged-out caller gets the same 404 as everyone else
// rather than a redirect to sign in for a page that doesn't exist yet.
function notFoundUnlessEnabled(_request, h) {
  if (!config.get('featureFlags.inYearChangesEnabled')) {
    throw Boom.notFound()
  }
  return h.continue
}

export const manageRouteOptions = {
  ...requireOperator,
  ext: { onPreAuth: { method: notFoundUnlessEnabled } }
}

export function dashboardUrl(
  { organisationId, registrationId, materialType },
  currentLocale
) {
  return `${localePrefix(currentLocale)}/manage/${organisationId}/${registrationId}/${materialType}`
}

export function registrationAccreditationUrl(params, currentLocale) {
  return `${dashboardUrl(params, currentLocale)}/registration-accreditation`
}

export function overseasSitesUrl(params, currentLocale) {
  return `${dashboardUrl(params, currentLocale)}/overseas-sites`
}

export function serviceProblem(request, h, t) {
  return h
    .view('errors/service-problem', {
      pageTitle: t('common.errors.serviceTitle'),
      retryUrl: request.path
    })
    .code(statusCodes.internalServerError)
}

export function manageCaption(application, t) {
  return composeApplicationCaption({
    operatorName: application.organisationName,
    year: application.year,
    materialType: materialDisplayName(application, t)
  })
}

/**
 * With exportersOnly, a reprocessor's accreditation is a 404 whatever state
 * its registration is in: the page doesn't exist for them, so that answer
 * shouldn't depend on whether the registration happens to be Approved.
 *
 * Returns { response } when the page must not render — the service-problem
 * page — otherwise { application, registration, t, currentLocale }.
 */
export async function loadManagePage(
  request,
  h,
  { exportersOnly = false } = {}
) {
  const { t, currentLocale } = getLocaleAndTranslator(request)
  const { organisationId, registrationId, materialType } = request.params

  const canAccess = await operatorCanAccessOrganisation(
    getUser(request),
    organisationId,
    { logger: request.logger }
  )
  if (!canAccess) {
    throw Boom.forbidden('You do not have access to this organisation')
  }

  const [application, registration] = await Promise.all([
    fetchCurrentAccreditation({
      organisationId,
      registrationId,
      materialType,
      logger: request.logger
    }),
    fetchApprovedRegistration({ registrationId, logger: request.logger })
  ])
  if (exportersOnly && application && !application.isExporter) {
    throw Boom.notFound()
  }
  if (!application || !registration) {
    return { response: serviceProblem(request, h, t) }
  }

  return { application, registration, t, currentLocale }
}
