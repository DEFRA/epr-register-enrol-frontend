import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { landingUrl } from '../../common/helpers/accreditationUrls.js'
import { NON_WITHDRAWABLE_STATUSES } from '../../common/helpers/accreditationSelection.js'

const MAX_REASON_WORDS = 200

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function renderPage(h, viewData) {
  return h.view('accreditation/withdraw-application/index', viewData)
}

export function validateWithdrawApplication(confirmWithdraw, reason, t) {
  const errors = {}
  if (confirmWithdraw !== 'yes' && confirmWithdraw !== 'no') {
    errors.confirmWithdraw = {
      text: t('pages.withdrawApplication.validation.confirmRequired')
    }
    return errors
  }

  if (confirmWithdraw === 'yes') {
    if (!reason?.trim()) {
      errors.reason = {
        text: t('pages.withdrawApplication.validation.reasonRequired')
      }
    } else if (countWords(reason) > MAX_REASON_WORDS) {
      errors.reason = {
        text: t('pages.withdrawApplication.validation.reasonTooLong')
      }
    }
  }

  return errors
}

function baseViewData(t, applicationId, confirmWithdraw, reason) {
  return {
    pageTitle: t('pages.withdrawApplication.title'),
    heading: t('pages.withdrawApplication.heading'),
    warningText: t('pages.withdrawApplication.warningText'),
    yesLabel: t('pages.withdrawApplication.yesLabel'),
    noLabel: t('pages.withdrawApplication.noLabel'),
    reasonLabel: t('pages.withdrawApplication.reasonLabel'),
    reasonHint: t('pages.withdrawApplication.reasonHint'),
    submitButton: t('pages.withdrawApplication.submitButton'),
    backLink: `/accreditation/task-list/${applicationId}`,
    confirmWithdraw: confirmWithdraw ?? null,
    reason: reason ?? ''
  }
}

export const withdrawApplicationGetController = {
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
        error: t('pages.withdrawApplication.validation.fetchError')
      }).code(500)
    }

    if (NON_WITHDRAWABLE_STATUSES.has(application.applicationStatus)) {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    return renderPage(h, baseViewData(t, applicationId))
  }
}

export const withdrawApplicationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { confirmWithdraw, reason } = request.payload ?? {}

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
        ...baseViewData(t, applicationId, confirmWithdraw, reason),
        error: t('pages.withdrawApplication.validation.fetchError')
      }).code(500)
    }

    if (NON_WITHDRAWABLE_STATUSES.has(application.applicationStatus)) {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    const errors = validateWithdrawApplication(confirmWithdraw, reason, t)
    if (Object.keys(errors).length > 0) {
      return renderPage(h, {
        ...baseViewData(t, applicationId, confirmWithdraw, reason),
        errors
      }).code(400)
    }

    if (confirmWithdraw === 'no') {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    try {
      const user = getUser(request)
      await accreditationApiService.withdrawApplication(
        organisationId,
        applicationId,
        { reason: reason.trim(), fullName: user?.name, email: user?.email }
      )
    } catch (err) {
      request.server.logger.error(
        `Error withdrawing application ${applicationId}: ${err.message}`
      )
      if (err.status === 409) {
        return renderPage(h, {
          ...baseViewData(t, applicationId, confirmWithdraw, reason),
          error: t('pages.withdrawApplication.validation.alreadyWithdrawnError')
        }).code(409)
      }
      if (err.status === 502) {
        return renderPage(h, {
          ...baseViewData(t, applicationId, confirmWithdraw, reason),
          error: t('pages.withdrawApplication.validation.withdrawError')
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
        ...baseViewData(t, applicationId, confirmWithdraw, reason),
        error: t('pages.withdrawApplication.validation.withdrawError')
      }).code(400)
    }

    request.yar.flash(
      'notification',
      t('pages.withdrawApplication.successMessage')
    )

    return h.redirect(landingUrl(application, application.isExporter))
  }
}
