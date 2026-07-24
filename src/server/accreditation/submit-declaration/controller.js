import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function confirmationUrl(applicationId) {
  return `/accreditation/submit-confirmation/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/submit-declaration/index', viewData)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateDeclaration(fullName, jobTitle, email, t) {
  const errors = {}
  if (!fullName?.trim()) {
    errors.fullName = {
      text: t('pages.submitDeclaration.validation.fullNameRequired')
    }
  }
  if (!jobTitle?.trim()) {
    errors.jobTitle = {
      text: t('pages.submitDeclaration.validation.jobTitleRequired')
    }
  }
  if (!email?.trim()) {
    errors.email = {
      text: t('pages.submitDeclaration.validation.emailRequired')
    }
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = {
      text: t('pages.submitDeclaration.validation.emailInvalid')
    }
  }
  return errors
}

export const submitDeclarationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params

    const saved = request.yar.get(ACCREDITATION_SESSION_KEYS.declaration) ?? {}

    return renderPage(h, {
      pageTitle: t('pages.submitDeclaration.title'),
      heading: t('pages.submitDeclaration.heading'),
      declarationSubHeading: t('pages.submitDeclaration.declarationSubHeading'),
      declarationText: t('pages.submitDeclaration.declarationText'),
      warningText: t('pages.submitDeclaration.warningText'),
      fullNameLabel: t('pages.submitDeclaration.fullNameLabel'),
      jobTitleLabel: t('pages.submitDeclaration.jobTitleLabel'),
      emailLabel: t('pages.submitDeclaration.emailLabel'),
      backLink: taskListUrl(applicationId),
      fullName: saved.fullName ?? '',
      jobTitle: saved.jobTitle ?? '',
      email: saved.email ?? ''
    })
  }
}

export const submitDeclarationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const {
      fullName,
      jobTitle,
      email,
      submitAction = 'submit'
    } = request.payload ?? {}

    if (submitAction === 'saveAndComeLater') {
      request.yar.set(ACCREDITATION_SESSION_KEYS.declaration, {
        fullName: fullName ?? '',
        jobTitle: jobTitle ?? '',
        email: email ?? ''
      })
      return h.redirect(taskListUrl(applicationId))
    }

    const errors = validateDeclaration(fullName, jobTitle, email, t)

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        pageTitle: t('pages.submitDeclaration.title'),
        heading: t('pages.submitDeclaration.heading'),
        declarationSubHeading: t(
          'pages.submitDeclaration.declarationSubHeading'
        ),
        declarationText: t('pages.submitDeclaration.declarationText'),
        warningText: t('pages.submitDeclaration.warningText'),
        fullNameLabel: t('pages.submitDeclaration.fullNameLabel'),
        jobTitleLabel: t('pages.submitDeclaration.jobTitleLabel'),
        emailLabel: t('pages.submitDeclaration.emailLabel'),
        backLink: taskListUrl(applicationId),
        fullName: fullName ?? '',
        jobTitle: jobTitle ?? '',
        email: email ?? '',
        errors
      }).code(400)
    }

    let response
    try {
      response = await accreditationApiService.submitApplication(
        organisationId,
        applicationId,
        {
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim(),
          email: email.trim()
        }
      )
    } catch (err) {
      request.server.logger.error(
        `Error submitting application ${applicationId}: ${err.message}${err.response ? ` - response: ${err.response}` : ''}`
      )
      if (!err.status || err.status >= 500) {
        return h
          .view('errors/service-problem', {
            pageTitle: t('common.errors.serviceTitle'),
            retryUrl: request.path
          })
          .code(500)
      }
      return renderPage(h, {
        pageTitle: t('pages.submitDeclaration.title'),
        heading: t('pages.submitDeclaration.heading'),
        declarationSubHeading: t(
          'pages.submitDeclaration.declarationSubHeading'
        ),
        declarationText: t('pages.submitDeclaration.declarationText'),
        warningText: t('pages.submitDeclaration.warningText'),
        fullNameLabel: t('pages.submitDeclaration.fullNameLabel'),
        jobTitleLabel: t('pages.submitDeclaration.jobTitleLabel'),
        emailLabel: t('pages.submitDeclaration.emailLabel'),
        backLink: taskListUrl(applicationId),
        fullName: fullName ?? '',
        jobTitle: jobTitle ?? '',
        email: email ?? '',
        error: t('pages.submitDeclaration.validation.submitError')
      }).code(400)
    }

    request.yar.set(
      ACCREDITATION_SESSION_KEYS.accreditationReference,
      response.accreditationReference
    )
    request.yar.clear(ACCREDITATION_SESSION_KEYS.declaration)

    return h.redirect(confirmationUrl(applicationId))
  }
}
