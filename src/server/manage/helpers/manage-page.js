import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { composeApplicationCaption } from '../../common/helpers/applicationHeader.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { operatorCanAccessOrganisation } from '../../common/helpers/reex-organisation-service.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { currentYear } from '../../common/helpers/currentYear.js'
import { fetchCurrentAccreditation } from './current-accreditation.js'
import {
  fetchRegistration,
  isApprovedRegistration
} from './current-registration.js'

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
  registrationId: registration.registrationId,
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

// The backend names the organisation only once ReEx confirms it holds the
// registration: with no accreditation, nothing else ties the URL's
// registration to its organisation.
const registrationMatchesUrl = (registration, materialType) =>
  Boolean(registration.organisationName) &&
  sameMaterial(registration.materialType, materialType)

async function assertCanAccessOrganisation(request, organisationId) {
  const canAccess = await operatorCanAccessOrganisation(
    getUser(request),
    organisationId,
    { logger: request.logger }
  )
  if (!canAccess) {
    throw Boom.forbidden('You do not have access to this organisation')
  }
}

// Throws a 404 for a reprocessor when the page is for exporters only.
function assertExporterIfRequired(exportersOnly, operator) {
  if (exportersOnly && !operator.isExporter) {
    throw Boom.notFound()
  }
}

/**
 * With exportersOnly, a reprocessor's accreditation is a 404 whatever state
 * its registration is in: the page doesn't exist for them, so that answer
 * shouldn't depend on whether the registration happens to be Approved. A
 * registration-only reprocessor is a 404 too.
 *
 * RA-739: the URL's registration number is resolved first, as the
 * accreditation is found by the registration's ReEx id; a number with no
 * registration record is the service-problem page, as there is then no
 * accreditation to tell a reprocessor by.
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
  const { organisationId, registrationNumber, materialType } = request.params

  await assertCanAccessOrganisation(request, organisationId)

  const registration = await fetchRegistration({
    organisationId,
    registrationNumber,
    logger: request.logger
  })
  if (!registration) {
    return { response: serviceProblem(request, h, t) }
  }

  const accreditation = await fetchCurrentAccreditation({
    organisationId,
    registrationId: registration.registrationId,
    materialType,
    logger: request.logger
  })
  const application = accreditation.application ?? null
  if (application) {
    assertExporterIfRequired(exportersOnly, application)
  }
  if (
    accreditation.failed ||
    !isApprovedRegistration(registration, request.logger)
  ) {
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

  if (
    !allowRegistrationOnly ||
    !registrationMatchesUrl(registration, materialType)
  ) {
    return { response: serviceProblem(request, h, t) }
  }
  // As for an accredited reprocessor; once the registration is known to be
  // the URL's, since only then is this registration only.
  assertExporterIfRequired(exportersOnly, registration)

  return {
    context: registrationOnlyContext(registration),
    application: null,
    registration,
    t,
    currentLocale
  }
}
