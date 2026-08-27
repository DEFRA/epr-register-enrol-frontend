import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

// RA-486: R12/R13 are the mandatory codes on the interim-site recycling
// operations question — at least one must be selected. R3/R4/R5 are
// optional here (material is inherited from the parent ORS, so there is no
// materialType-based filtering of the option set on this page).
const ALL_CODES = ['R3', 'R4', 'R5', 'R12', 'R13']
const CORE_CODES = new Set(['R12', 'R13'])
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
  return ALL_CODES.map((code) => ({
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

function hasCoreCode(codes) {
  return codes.some((c) => CORE_CODES.has(c))
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

    if (
      recyclingOperationCodes.length === 0 ||
      !recyclingOperationCodes.every((code) => ALL_CODES.includes(code))
    ) {
      return renderError(
        t('pages.addInterimSite.recyclingOperationDetails.validation.required')
      )
    }

    if (!hasCoreCode(recyclingOperationCodes)) {
      return renderError(
        t(
          'pages.addInterimSite.recyclingOperationDetails.validation.coreCodeRequired'
        )
      )
    }

    setAddInterimSiteSession(request, { recyclingOperationCodes })
    return h.redirect(checkYourAnswersUrl(applicationId))
  }
}
