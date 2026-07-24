import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { landingUrl } from '../../common/helpers/accreditationUrls.js'

function renderPage(h, viewData) {
  return h.view('accreditation/query-declaration/index', viewData)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function baseViewData(t, applicationId, fullName, email, role) {
  return {
    pageTitle: t('pages.queryDeclaration.title'),
    heading: t('pages.queryDeclaration.heading'),
    declarationSubHeading: t('pages.queryDeclaration.declarationSubHeading'),
    declarationText: t('pages.queryDeclaration.declarationText'),
    warningText: t('pages.queryDeclaration.warningText'),
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
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${error.message}`
      )
      return renderPage(h, {
        ...baseViewData(t, applicationId),
        error: t('pages.queryDeclaration.validation.fetchError')
      }).code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    return renderPage(h, baseViewData(t, applicationId))
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
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${error.message}`
      )
      return renderPage(h, {
        ...baseViewData(t, applicationId, fullName, email, role),
        error: t('pages.queryDeclaration.validation.fetchError')
      }).code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    const errors = validateQueryDeclaration(fullName, email, role, t)
    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...baseViewData(t, applicationId, fullName, email, role),
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
      request.server.logger.error(
        `Error resubmitting application ${applicationId}: ${err.message}`
      )
      if (err.status === 409) {
        return renderPage(h, {
          ...baseViewData(t, applicationId, fullName, email, role),
          error: t('pages.queryDeclaration.validation.notQueriedError')
        }).code(409)
      }
      if (err.status === 502) {
        return renderPage(h, {
          ...baseViewData(t, applicationId, fullName, email, role),
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
        ...baseViewData(t, applicationId, fullName, email, role),
        error: t('pages.queryDeclaration.validation.resubmitError')
      }).code(400)
    }

    request.yar.flash(
      'notification',
      t('pages.queryDeclaration.successMessage')
    )

    return h.redirect(landingUrl(application, application.isExporter))
  }
}
