import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession,
  resetAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-location`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-name`
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
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const session = getAddOrsSession(request)
    return renderPage(
      h,
      buildViewData(t, applicationId, session.siteName ?? '', null)
    )
  }
}

export const addOrsiteNamePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

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

// Entry point for the "Add new overseas reprocessing site" button on select-overseas-sites.
// Resets the wizard session before handing off to site-name, so a promotingSiteId left over
// from an abandoned "Add To Accreditation" attempt can't leak into an unrelated new site and
// get silently promoted onto it (site-name's own GET handler must NOT do this reset, since it
// also serves as the wizard's "Back" target and would wipe in-progress answers).
export const addOrsStartController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

    const guardRedirect = await guardOverseasSiteWizardEntry({
      h,
      organisationId,
      applicationId,
      fallbackUrl: selectOrsUrl(applicationId)
    })
    if (guardRedirect) {
      return guardRedirect
    }

    resetAddOrsSession(request)
    return h.redirect(siteNameUrl(applicationId))
  }
}
