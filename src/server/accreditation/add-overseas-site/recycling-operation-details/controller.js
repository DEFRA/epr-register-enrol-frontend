import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const OPERATION_CODES = [
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
  'R10',
  'R11',
  'R12',
  'R13'
]

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-contact-details`
}

function baselCodeUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/recycling-operation-details/index',
    viewData
  )
}

function buildOptions(t, selectedCode) {
  return OPERATION_CODES.map((code) => ({
    value: code,
    text: t(
      `pages.addOverseasSite.recyclingOperationDetails.operations.${code}`
    ),
    selected: code === selectedCode
  }))
}

function buildViewData(t, applicationId, selectedCode, error) {
  return {
    pageTitle: t('pages.addOverseasSite.recyclingOperationDetails.title'),
    heading: t('pages.addOverseasSite.recyclingOperationDetails.heading'),
    label: t('pages.addOverseasSite.recyclingOperationDetails.label'),
    selectDefault: t(
      'pages.addOverseasSite.recyclingOperationDetails.selectDefault'
    ),
    continueButton: t(
      'pages.addOverseasSite.recyclingOperationDetails.continueButton'
    ),
    cancelLink: t('pages.addOverseasSite.recyclingOperationDetails.cancelLink'),
    backLink: siteContactDetailsUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    options: buildOptions(t, selectedCode),
    selectedCode,
    error
  }
}

export const addOrsRecyclingOperationGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        session.recyclingOperationCode ?? '',
        null
      )
    )
  }
}

export const addOrsRecyclingOperationPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const recyclingOperationCode = (
      request.payload?.recyclingOperationCode ?? ''
    ).trim()

    if (!recyclingOperationCode) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          '',
          t(
            'pages.addOverseasSite.recyclingOperationDetails.validation.required'
          )
        )
      ).code(400)
    }

    setAddOrsSession(request, { recyclingOperationCode })
    return h.redirect(baselCodeUrl(applicationId))
  }
}
