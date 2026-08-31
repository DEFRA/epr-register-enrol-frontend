import Joi from 'joi'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { landingUrl } from '../../common/helpers/accreditationUrls.js'
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'

function renderPage(h, viewData) {
  return h.view('accreditation/query-declaration/index', viewData)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/

// Type/size only, not "is this a real name/email": validateQueryDeclaration
// already renders its own friendly inline errors for missing/malformed
// values. Without this, a non-string fullName/email/role (e.g. an array)
// crashes `.trim()` below with an unhandled exception rather than a graceful
// error (M1, 2026-08-08 pentest report). .unknown(true) lets the CSRF crumb
// field through.
export const queryDeclarationPayloadSchema = Joi.object({
  fullName: Joi.string().allow('').max(200).optional(),
  email: Joi.string().allow('').max(320).optional(),
  role: Joi.string().allow('').max(200).optional()
}).unknown(true)

export function validateQueryDeclaration(fullName, email, role, t) {
  const errors = {}
  if (!fullName?.trim()) {
    errors.fullName = {
      text: t('pages.queryDeclaration.validation.fullNameRequired')
    }
  }
  if (!email?.trim()) {
    errors.email = {
      text: t('pages.queryDeclaration.validation.emailRequired')
    }
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = {
      text: t('pages.queryDeclaration.validation.emailInvalid')
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

function baseViewData(
  t,
  applicationId,
  fullName,
  email,
  role,
  organisationName = ''
) {
  return {
    pageTitle: t('pages.queryDeclaration.title'),
    heading: t('pages.queryDeclaration.heading'),
    declarationSubHeading: t('pages.queryDeclaration.declarationSubHeading'),
    declarationIntro: t('pages.queryDeclaration.declarationIntro'),
    bullets: buildBullets(organisationName, t),
    warningText: t('common.declarationWarningText'),
    fullNameLabel: t('pages.queryDeclaration.fullNameLabel'),
    emailLabel: t('pages.queryDeclaration.emailLabel'),
    roleLabel: t('pages.queryDeclaration.roleLabel'),
    backLink: `/accreditation/query-task-list/${applicationId}`,
    fullName: fullName ?? '',
    email: email ?? '',
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

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      logControllerError(
        request.server.logger,
        error,
        { applicationId },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        ...baseViewData(t, applicationId),
        error: t('pages.queryDeclaration.validation.fetchError')
      }).code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application))
    }

    return renderPage(
      h,
      baseViewData(
        t,
        applicationId,
        undefined,
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
    const { fullName, email, role } = request.payload ?? {}

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      logControllerError(
        request.server.logger,
        error,
        { applicationId },
        `Error fetching application ${applicationId}`
      )
      return renderPage(h, {
        ...baseViewData(t, applicationId, fullName, email, role),
        error: t('pages.queryDeclaration.validation.fetchError')
      }).code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application))
    }

    const errors = validateQueryDeclaration(fullName, email, role, t)
    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...baseViewData(
          t,
          applicationId,
          fullName,
          email,
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
          email: email.trim(),
          role: role.trim()
        }
      )
    } catch (err) {
      logControllerError(
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
            email,
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
            email,
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
          email,
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
