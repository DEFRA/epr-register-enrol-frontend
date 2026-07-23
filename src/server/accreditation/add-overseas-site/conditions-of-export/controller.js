import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

function repatriatedLoadsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/repatriated-loads`
}

function cyaUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/check-your-answers`
}

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/conditions-of-export/index',
    viewData
  )
}

function buildViewData(t, applicationId, selected, error) {
  return {
    pageTitle: t('pages.addOverseasSite.conditionsOfExport.title'),
    heading: t('pages.addOverseasSite.conditionsOfExport.heading'),
    intro: t('pages.addOverseasSite.conditionsOfExport.intro'),
    conditions: [
      t('pages.addOverseasSite.conditionsOfExport.condition1'),
      t('pages.addOverseasSite.conditionsOfExport.condition2'),
      t('pages.addOverseasSite.conditionsOfExport.condition3'),
      t('pages.addOverseasSite.conditionsOfExport.condition4'),
      t('pages.addOverseasSite.conditionsOfExport.condition5'),
      t('pages.addOverseasSite.conditionsOfExport.condition6')
    ],
    questionLabel: t('pages.addOverseasSite.conditionsOfExport.questionLabel'),
    yesLabel: t('pages.addOverseasSite.conditionsOfExport.yesLabel'),
    noLabel: t('pages.addOverseasSite.conditionsOfExport.noLabel'),
    continueButton: t(
      'pages.addOverseasSite.conditionsOfExport.continueButton'
    ),
    cancelLink: t('pages.addOverseasSite.conditionsOfExport.cancelLink'),
    backLink: repatriatedLoadsUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    selected,
    error
  }
}

export const addOrsConditionsOfExportGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const selected =
      session.conditionsOfExport === true
        ? 'yes'
        : session.conditionsOfExport === false
          ? 'no'
          : null
    return renderPage(h, buildViewData(t, applicationId, selected, null))
  }
}

export const addOrsConditionsOfExportPostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const value = request.payload?.conditionsOfExport

    if (value !== 'yes' && value !== 'no') {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          null,
          t('pages.addOverseasSite.conditionsOfExport.validation.required')
        )
      ).code(400)
    }

    setAddOrsSession(request, { conditionsOfExport: value === 'yes' })
    return h.redirect(cyaUrl(applicationId))
  }
}
