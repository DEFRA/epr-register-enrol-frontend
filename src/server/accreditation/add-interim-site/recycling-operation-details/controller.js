import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'
import {
  INTERIM_OPERATION_CODES,
  validateInterimOperationCodes
} from '../../../common/helpers/interimSiteValidation.js'

const BAD_REQUEST_STATUS_CODE = 400

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-contact-details`
}

function checkYourAnswersUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/check-your-answers`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-interim-site/recycling-operation-details/index',
    viewData
  )
}

function buildOptions(t, selectedCodes) {
  return INTERIM_OPERATION_CODES.map((code) => ({
    value: code,
    text: t(
      `pages.addInterimSite.recyclingOperationDetails.operations.${code}`
    ),
    checked: selectedCodes.includes(code)
  }))
}

function buildViewData(t, applicationId, selectedCodes, error) {
  return {
    pageTitle: t('pages.addInterimSite.recyclingOperationDetails.title'),
    heading: t('pages.addInterimSite.recyclingOperationDetails.heading'),
    label: t('pages.addInterimSite.recyclingOperationDetails.label'),
    continueButton: t(
      'pages.addInterimSite.recyclingOperationDetails.continueButton'
    ),
    cancelLink: t('pages.addInterimSite.recyclingOperationDetails.cancelLink'),
    backLink: siteContactDetailsUrl(applicationId),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    options: buildOptions(t, selectedCodes),
    error
  }
}

function normaliseCodes(raw) {
  let values
  if (raw == null) {
    values = []
  } else if (Array.isArray(raw)) {
    values = raw
  } else {
    values = [raw]
  }
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

export const addInterimSiteRecyclingOperationGetController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const { t, guardRedirect } = await enterInterimSiteWizardStep({
      request,
      h,
      applicationId
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const session = getAddInterimSiteSession(request)

    const linkedSiteGuardRedirect = guardInterimSiteLinkedSiteId({
      h,
      session,
      fallbackUrl: selectOverseasSitesUrl(applicationId)
    })
    if (linkedSiteGuardRedirect) {
      return linkedSiteGuardRedirect
    }

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        session.recyclingOperationCodes ?? [],
        null
      )
    )
  }
}

export const addInterimSiteRecyclingOperationPostController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const { t, guardRedirect } = await enterInterimSiteWizardStep({
      request,
      h,
      applicationId
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const recyclingOperationCodes = normaliseCodes(
      request.payload?.recyclingOperationCodes
    )

    const renderError = (message) =>
      renderPage(
        h,
        buildViewData(t, applicationId, recyclingOperationCodes, message)
      ).code(BAD_REQUEST_STATUS_CODE)

    const error = validateInterimOperationCodes(t, recyclingOperationCodes)
    if (error) {
      return renderError(error)
    }

    setAddInterimSiteSession(request, { recyclingOperationCodes })
    return h.redirect(checkYourAnswersUrl(applicationId))
  }
}
