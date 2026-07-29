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

export function validateDeclaration(fullName, t) {
  const errors = {}
  if (!fullName?.trim()) {
    errors.fullName = {
      text: t('pages.submitDeclaration.validation.fullNameRequired')
    }
  }
  return errors
}

function buildBullets(organisationName, t) {
  return [
    t('pages.submitDeclaration.bullets.eligiblePerson').replace(
      '{organisationName}',
      organisationName
    ),
    t('pages.submitDeclaration.bullets.accurateInformation'),
    t('pages.submitDeclaration.bullets.enforcementAction')
  ]
}

function buildViewData(t, applicationId, organisationName, fullName) {
  return {
    pageTitle: t('pages.submitDeclaration.title'),
    heading: t('pages.submitDeclaration.heading'),
    declarationIntro: t('pages.submitDeclaration.declarationIntro'),
    bullets: buildBullets(organisationName, t),
    fullNameLabel: t('pages.submitDeclaration.fullNameLabel'),
    fullNameHint: t('pages.submitDeclaration.fullNameHint'),
    backLink: taskListUrl(applicationId),
    fullName: fullName ?? ''
  }
}

export const submitDeclarationGetController = {
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
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, ''),
        error: t('pages.submitDeclaration.validation.fetchError')
      }).code(500)
    }

    const saved = request.yar.get(ACCREDITATION_SESSION_KEYS.declaration) ?? {}

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        application.organisationName ?? '',
        saved.fullName
      )
    )
  }
}

export const submitDeclarationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { fullName, submitAction = 'submit' } = request.payload ?? {}

    if (submitAction === 'saveAndComeLater') {
      request.yar.set(ACCREDITATION_SESSION_KEYS.declaration, {
        fullName: fullName ?? ''
      })
      return h.redirect(taskListUrl(applicationId))
    }

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, '', fullName),
        error: t('pages.submitDeclaration.validation.fetchError')
      }).code(500)
    }

    const organisationName = application.organisationName ?? ''
    const errors = validateDeclaration(fullName, t)

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, organisationName, fullName),
        errors
      }).code(400)
    }

    let response
    try {
      response = await accreditationApiService.submitApplication(
        organisationId,
        applicationId,
        {
          fullName: fullName.trim()
        },
        // Submission can take substantially longer than the default global
        // API timeout while OJ BE hops through to CM BE, so use a longer
        // per-call timeout specifically for this request.
        { timeout: 20000 }
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
        ...buildViewData(t, applicationId, organisationName, fullName),
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
