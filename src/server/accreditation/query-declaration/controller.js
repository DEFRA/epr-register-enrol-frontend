import Joi from 'joi'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  landingUrl,
  redirectIfStatusNot
} from '../../common/helpers/accreditationUrls.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import { redirectIfSitesIncomplete } from '../../common/helpers/incompleteSitesGate.js'

function renderPage(h, viewData) {
  return h.view('accreditation/query-declaration/index', viewData)
}

// Type/size only, not "is this a real name": validateQueryDeclaration
// already renders its own friendly inline errors for missing values.
// Without this, a non-string fullName/role (e.g. an array)
// crashes `.trim()` below with an unhandled exception rather than a graceful
// error (M1, 2026-08-08 pentest report). .unknown(true) lets the CSRF crumb
// field through.
export const queryDeclarationPayloadSchema = Joi.object({
  fullName: Joi.string().allow('').max(200).optional(),
  role: Joi.string().allow('').max(200).optional()
}).unknown(true)

export function validateQueryDeclaration(fullName, role, t) {
  const errors = {}
  if (!fullName?.trim()) {
    errors.fullName = {
      text: t('pages.queryDeclaration.validation.fullNameRequired')
    }
  }
  if (!role?.trim()) {
    errors.role = {
      text: t('pages.queryDeclaration.validation.roleRequired')
    }
  }
  return errors
}

function buildBullets(organisationName, t) {
  return [
    t('pages.queryDeclaration.bullets.eligiblePerson').replace(
      '{organisationName}',
      organisationName
    ),
    t('pages.queryDeclaration.bullets.accurateInformation'),
    t('pages.queryDeclaration.bullets.enforcementAction')
  ]
}

function baseViewData(t, applicationId, fullName, role, organisationName = '') {
  return {
    pageTitle: t('pages.queryDeclaration.title'),
    heading: t('pages.queryDeclaration.heading'),
    declarationSubHeading: t('pages.queryDeclaration.declarationSubHeading'),
    declarationIntro: t('pages.queryDeclaration.declarationIntro'),
    bullets: buildBullets(organisationName, t),
    fullNameLabel: t('pages.queryDeclaration.fullNameLabel'),
    fullNameHint: t('pages.queryDeclaration.fullNameHint'),
    roleLabel: t('pages.queryDeclaration.roleLabel'),
    roleHint: t('pages.queryDeclaration.roleHint'),
    backLink: `/accreditation/query-task-list/${applicationId}`,
    fullName: fullName ?? '',
    role: role ?? ''
  }
}

export const queryDeclarationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(h, {
          ...baseViewData(t, applicationId),
          error: t('pages.queryDeclaration.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const statusRedirect = redirectIfStatusNot(h, application, 'Queried')
    if (statusRedirect) {
      return statusRedirect
    }

    const incompleteRedirect = redirectIfSitesIncomplete({
      request,
      h,
      t,
      application,
      applicationId
    })
    if (incompleteRedirect) {
      return incompleteRedirect
    }

    return renderPage(
      h,
      baseViewData(
        t,
        applicationId,
        undefined,
        undefined,
        application.organisationName ?? ''
      )
    )
  }
}

export const queryDeclarationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { fullName, role } = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(h, {
          ...baseViewData(t, applicationId, fullName, role),
          error: t('pages.queryDeclaration.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const statusRedirect = redirectIfStatusNot(h, application, 'Queried')
    if (statusRedirect) {
      return statusRedirect
    }

    const incompleteRedirect = redirectIfSitesIncomplete({
      request,
      h,
      t,
      application,
      applicationId
    })
    if (incompleteRedirect) {
      return incompleteRedirect
    }

    const errors = validateQueryDeclaration(fullName, role, t)
    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...baseViewData(
          t,
          applicationId,
          fullName,
          role,
          application.organisationName ?? ''
        ),
        errors
      }).code(400)
    }

    try {
      await accreditationApiService.resubmitApplication(
        organisationId,
        applicationId,
        {
          fullName: fullName.trim(),
          email: request.auth.credentials.email,
          role: role.trim()
        }
      )
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        { applicationId },
        `Error resubmitting application ${applicationId}`
      )
      if (err.status === 409) {
        return renderPage(h, {
          ...baseViewData(
            t,
            applicationId,
            fullName,
            role,
            application.organisationName ?? ''
          ),
          error: t('pages.queryDeclaration.validation.notQueriedError')
        }).code(409)
      }
      if (err.status === 502) {
        return renderPage(h, {
          ...baseViewData(
            t,
            applicationId,
            fullName,
            role,
            application.organisationName ?? ''
          ),
          error: t('pages.queryDeclaration.validation.resubmitError')
        }).code(502)
      }
      if (!err.status || err.status >= 500) {
        return h
          .view('errors/service-problem', {
            pageTitle: t('common.errors.serviceTitle'),
            retryUrl: request.path
          })
          .code(500)
      }
      return renderPage(h, {
        ...baseViewData(
          t,
          applicationId,
          fullName,
          role,
          application.organisationName ?? ''
        ),
        error: t('pages.queryDeclaration.validation.resubmitError')
      }).code(400)
    }

    request.yar.flash(
      'notification',
      t('pages.queryDeclaration.successMessage')
    )

    return h.redirect(landingUrl(application))
  }
}
