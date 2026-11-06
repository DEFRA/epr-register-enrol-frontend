import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { composeApplicationCaption } from '../../common/helpers/applicationHeader.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { localePrefix } from '../../common/helpers/localePrefix.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { currentYear } from '../../common/helpers/currentYear.js'
import { accreditationChangesService } from '../../accreditation/manage-overseas-sites/service.js'
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

// The manage registration and accreditation page, which Re/Ex links to.
export function manageUrl(
  { organisationId, registrationId, materialType },
  currentLocale
) {
  return `${localePrefix(currentLocale)}/manage/${organisationId}/${registrationId}/${materialType}`
}

export function overseasSitesUrl(params, currentLocale) {
  return `${manageUrl(params, currentLocale)}/overseas-sites`
}

export function serviceProblem(request, h, t) {
  return h
    .view('errors/service-problem', {
      pageTitle: t('common.errors.serviceTitle'),
      retryUrl: request.path
    })
    .code(statusCodes.internalServerError)
}

/**
 * @param {{ organisationName: string, year: number, materialType: string, glassRecyclingProcess?: string|string[]|null }} context
 *   the manage context, or an accreditation application
 */
export function manageCaption(context, t) {
  return composeApplicationCaption({
    operatorName: context.organisationName,
    year: context.year,
    materialType: materialDisplayName(context, t)
  })
}

const registrationFields = (registration) => ({
  registrationNumber: registration.registrationNumber,
  registrationStatus: registration.status
})

// RA-697: unchanged for an accredited operator, whose details still come from
// the accreditation.
function accreditedContext(application, registration) {
  return {
    isRegistrationOnly: false,
    organisationName: application.organisationName,
    year: application.year,
    materialType: application.materialType,
    glassRecyclingProcess: application.glassRecyclingProcess,
    isExporter: application.isExporter,
    siteAddress: application.siteAddress,
    ...registrationFields(registration),
    application
  }
}

// RA-697: the compliance period is the current calendar year, as for an
// accredited operator.
function registrationOnlyContext(registration) {
  return {
    isRegistrationOnly: true,
    organisationName: registration.organisationName,
    year: currentYear(),
    materialType: registration.materialType,
    glassRecyclingProcess: registration.glassRecyclingProcess,
    isExporter: registration.isExporter,
    siteAddress: registration.siteAddress,
    ...registrationFields(registration),
    application: null
  }
}

const sameMaterial = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.toLowerCase() === b.toLowerCase()

/**
 * With exportersOnly, a reprocessor's accreditation is a 404 whatever state
 * its registration is in: the page doesn't exist for them, so that answer
 * shouldn't depend on whether the registration happens to be Approved. A
 * registration-only reprocessor is a 404 too.
 *
 * RA-697: an Approved registration with no Approved current-year
 * accreditation is registration only. Pages opt in with allowRegistrationOnly
 * and branch on context.isRegistrationOnly; the others still show the
 * service-problem page, as does a failed accreditation lookup.
 *
 * Returns { response } when the page must not render — the service-problem
 * page — otherwise { context, application, registration, t, currentLocale },
 * where application is null for registration only.
 */
export async function loadManagePage(
  request,
  h,
  { exportersOnly = false, allowRegistrationOnly = false } = {}
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

  const [accreditation, registration] = await Promise.all([
    fetchCurrentAccreditation({
      organisationId,
      registrationId,
      materialType,
      logger: request.logger
    }),
    fetchApprovedRegistration({
      organisationId,
      registrationId,
      logger: request.logger
    })
  ])
  const application = accreditation.application ?? null
  if (exportersOnly && application && !application.isExporter) {
    throw Boom.notFound()
  }
  if (accreditation.failed || !registration) {
    return { response: serviceProblem(request, h, t) }
  }

  if (application) {
    return {
      context: accreditedContext(application, registration),
      application,
      registration,
      t,
      currentLocale
    }
  }

  // The backend names the organisation only once ReEx confirms it holds the
  // registration: with no accreditation, nothing else ties the URL's
  // registration to its organisation.
  if (
    !allowRegistrationOnly ||
    !registration.organisationName ||
    !sameMaterial(registration.materialType, materialType)
  ) {
    return { response: serviceProblem(request, h, t) }
  }
  // As for an accredited reprocessor; once the registration is known to be
  // the URL's, since only then is this registration only.
  if (exportersOnly && !registration.isExporter) {
    throw Boom.notFound()
  }

  return {
    context: registrationOnlyContext(registration),
    application: null,
    registration,
    t,
    currentLocale
  }
}

export function changeRequestsUrl(params, currentLocale) {
  return `${manageUrl(params, currentLocale)}/change-requests`
}

export function changeRequestItemUrl(params, itemId, currentLocale) {
  return `${changeRequestsUrl(params, currentLocale)}/${encodeURIComponent(itemId)}`
}

/**
 * RA-697: change requests are read only for the current-year accreditation
 * that loadManagePage resolves, so a previous year's unapplied requests, kept
 * against that year's accreditation, drop off the pages at year end. For a
 * registration-only context they are the registration's own, which the
 * backend reads for the current year.
 *
 * Returns null, having logged why, when they cannot be read; each page
 * decides what that means for it.
 *
 * @param {object} context - loadManagePage's context
 */
export async function fetchChangeRequestsView(request, context) {
  const { organisationId, registrationId, materialType } = request.params
  try {
    return context.isRegistrationOnly
      ? await accreditationChangesService.getRegistrationView(
          organisationId,
          registrationId,
          materialType
        )
      : await accreditationChangesService.getView(
          organisationId,
          context.application.applicationId
        )
  } catch (error) {
    logStructuredError(
      request.logger,
      error,
      {
        organisationId,
        registrationId,
        applicationId: context.application?.applicationId ?? null
      },
      'Error fetching the accreditation change requests'
    )
    return null
  }
}
