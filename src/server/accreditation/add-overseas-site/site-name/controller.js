import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  getAddOrsSession,
  setAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-location`
}

function renderPage(h, viewData) {
  return h.view('accreditation/add-overseas-site/site-name/index', viewData)
}

function buildViewData(t, applicationId, siteName, error) {
  return {
    pageTitle: t('pages.addOverseasSite.siteName.title'),
    heading: t('pages.addOverseasSite.siteName.heading'),
    label: t('pages.addOverseasSite.siteName.label'),
    hint: t('pages.addOverseasSite.siteName.hint'),
    continueButton: t('pages.addOverseasSite.siteName.continueButton'),
    cancelLink: t('pages.addOverseasSite.siteName.cancelLink'),
    siteName,
    backLink: selectOrsUrl(applicationId),
    cancelUrl: selectOrsUrl(applicationId),
    error
  }
}

export const addOrsiteNameGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    return renderPage(
      h,
      buildViewData(t, applicationId, session.siteName ?? '', null)
    )
  }
}

export const addOrsiteNamePostController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const siteName = (request.payload?.siteName ?? '').trim()

    if (!siteName) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          '',
          t('pages.addOverseasSite.siteName.validation.required')
        )
      ).code(400)
    }

    setAddOrsSession(request, { siteName })
    return h.redirect(siteLocationUrl(applicationId))
  }
}

export const addOrsCancelController = {
  handler(request, h) {
    const { applicationId } = request.params
    request.yar.clear(ACCREDITATION_SESSION_KEYS.addOverseasSite)
    return h.redirect(selectOrsUrl(applicationId))
  }
}
