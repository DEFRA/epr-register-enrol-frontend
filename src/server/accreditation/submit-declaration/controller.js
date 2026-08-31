import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  resolveNation,
  buildPaymentReference
} from '../../common/helpers/paymentDetails.js'

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

function buildViewData(t, applicationId, organisationName, fullName, jobTitle) {
  return {
    pageTitle: t('pages.submitDeclaration.title'),
    heading: t('pages.submitDeclaration.heading'),
    declarationIntro: t('pages.submitDeclaration.declarationIntro'),
    bullets: buildBullets(organisationName, t),
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

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        { applicationId, err },
        'Error fetching application'
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
        saved.fullName,
        saved.jobTitle
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
    const {
      fullName,
      jobTitle,
      submitAction = 'submit'
    } = request.payload ?? {}

    if (submitAction === 'saveAndComeLater') {
      request.yar.set(ACCREDITATION_SESSION_KEYS.declaration, {
        fullName: fullName ?? '',
        jobTitle: jobTitle ?? ''
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
        { applicationId, err },
        'Error fetching application'
      )
      return renderPage(h, {
        ...buildViewData(t, applicationId, '', fullName, jobTitle),
        error: t('pages.submitDeclaration.validation.fetchError')
      }).code(500)
    }

    const organisationName = application.organisationName ?? ''
    const errors = validateDeclaration(fullName, jobTitle, t)

    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...buildViewData(
          t,
          applicationId,
          organisationName,
          fullName,
          jobTitle
        ),
        errors
      }).code(400)
    }

    // RA-503: the operator's real, nation-specific bank payment reference - the exact string
    // shown to them on the submit-confirmation and view-payment-details pages
    // (buildPaymentReference, same helper both pages already use). Sent with the submission so
    // the regulator's duly-making page shows the same reference the operator was told to quote,
    // instead of a different one management-be generates independently.
    const nation = resolveNation(application)
    const paymentReference = buildPaymentReference(
      nation,
      application.organisationId,
      application.isExporter
    )

    let response
    try {
      response = await accreditationApiService.submitApplication(
        organisationId,
        applicationId,
        {
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim(),
          email: request.auth.credentials.email,
          paymentReference
        },
        // Submission can take substantially longer than the default global
        // API timeout while OJ BE hops through to CM BE, so use a longer
        // per-call timeout specifically for this request.
        { timeout: 20000 }
      )
    } catch (err) {
      request.server.logger.error(
        {
          applicationId,
          err,
          ...(err.response ? { responseBody: err.response } : {})
        },
        'Error submitting application'
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
        ...buildViewData(
          t,
          applicationId,
          organisationName,
          fullName,
          jobTitle
        ),
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
