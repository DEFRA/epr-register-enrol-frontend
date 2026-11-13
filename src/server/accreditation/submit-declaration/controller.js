import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import { redirectIfStatusNot } from '../../common/helpers/accreditationUrls.js'
import { redirectIfSitesIncomplete } from '../../common/helpers/incompleteSitesGate.js'
import { statusCodes } from '../../common/constants/status-codes.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function confirmationUrl(applicationId) {
  return `/accreditation/submit-confirmation/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/submit-declaration/index', viewData)
}

export function validateDeclaration(fullName, jobTitle, t) {
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
  return errors
}

function buildBullets(t) {
  return [
    t('pages.submitDeclaration.bullets.eligiblePerson'),
    t('pages.submitDeclaration.bullets.accurateInformation'),
    t('pages.submitDeclaration.bullets.enforcementAction')
  ]
}

export function buildViewData(t, applicationId, fullName, jobTitle) {
  return {
    pageTitle: t('pages.submitDeclaration.title'),
    heading: t('pages.submitDeclaration.heading'),
    declarationIntro: t('pages.submitDeclaration.declarationIntro'),
    bullets: buildBullets(t),
    fullNameLabel: t('pages.submitDeclaration.fullNameLabel'),
    fullNameHint: t('pages.submitDeclaration.fullNameHint'),
    jobTitleLabel: t('pages.submitDeclaration.jobTitleLabel'),
    jobTitleHint: t('pages.submitDeclaration.jobTitleHint'),
    backLink: taskListUrl(applicationId),
    fullName: fullName ?? '',
    jobTitle: jobTitle ?? ''
  }
}

export const submitDeclarationGetController = {
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
          ...buildViewData(t, applicationId),
          error: t('pages.submitDeclaration.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const statusRedirect = redirectIfStatusNot(h, application, 'Started')
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

    const saved = request.yar.get(ACCREDITATION_SESSION_KEYS.declaration) ?? {}

    return renderPage(
      h,
      buildViewData(t, applicationId, saved.fullName, saved.jobTitle)
    )
  }
}

// Extracted from submitDeclarationPostController's handler (SonarCloud cyclomatic
// complexity): the submit-failure branching (503, other 5xx, or a re-rendered
// validation-style 4xx) doesn't need to live inline in the handler.
function handleSubmitError(
  h,
  t,
  err,
  { applicationId, fullName, jobTitle, request }
) {
  request.server.logger.error(
    {
      applicationId,
      err,
      ...(err.response ? { responseBody: err.response } : {})
    },
    'Error submitting application'
  )
  // RA-000: the backend answers 503 when it can't build the payment
  // reference (no organisation number or nation), having sent nothing to the
  // regulator. Keep what the operator entered so they can try again.
  if (err.status === statusCodes.serviceUnavailable) {
    return renderPage(h, {
      ...buildViewData(t, applicationId, fullName, jobTitle),
      error: t('pages.submitDeclaration.validation.submitUnavailable')
    }).code(statusCodes.serviceUnavailable)
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
    ...buildViewData(t, applicationId, fullName, jobTitle),
    error: t('pages.submitDeclaration.validation.submitError')
  }).code(400)
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
      submitAction = 'submit'
    } = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(h, {
          ...buildViewData(t, applicationId, fullName, jobTitle),
          error: t('pages.submitDeclaration.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const statusRedirect = redirectIfStatusNot(h, application, 'Started')
    if (statusRedirect) {
      return statusRedirect
    }

    if (submitAction === 'saveAndComeLater') {
      request.yar.set(ACCREDITATION_SESSION_KEYS.declaration, {
        fullName: fullName ?? '',
        jobTitle: jobTitle ?? ''
      })
      return h.redirect(taskListUrl(applicationId))
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

    const errors = validateDeclaration(fullName, jobTitle, t)

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(t, applicationId, fullName, jobTitle),
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
          email: request.auth.credentials.email
        },
        // Submission can take substantially longer than the default global
        // API timeout while OJ BE hops through to CM BE, so use a longer
        // per-call timeout specifically for this request.
        { timeout: 20000 }
      )
    } catch (err) {
      return handleSubmitError(h, t, err, {
        applicationId,
        fullName,
        jobTitle,
        request
      })
    }

    request.yar.set(
      ACCREDITATION_SESSION_KEYS.accreditationReference,
      response.accreditationReference
    )
    request.yar.clear(ACCREDITATION_SESSION_KEYS.declaration)

    return h.redirect(confirmationUrl(applicationId))
  }
}
