import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  guardOverseasSiteWizardEntry,
  guardInterimSiteLinkedSiteId
} from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function countryUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/country`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-location`
}

function renderPage(h, viewData) {
  return h.view('accreditation/add-interim-site/site-name/index', viewData)
}

function buildViewData(t, applicationId, siteName, error) {
  return {
    pageTitle: t('pages.addInterimSite.siteName.title'),
    heading: t('pages.addInterimSite.siteName.heading'),
    label: t('pages.addInterimSite.siteName.label'),
    hint: t('pages.addInterimSite.siteName.hint'),
    continueButton: t('pages.addInterimSite.siteName.continueButton'),
    cancelLink: t('pages.addInterimSite.siteName.cancelLink'),
    siteName,
    backLink: countryUrl(applicationId),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    error
  }
}

export const addInterimSiteNameGetController = {
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
      fallbackUrl: selectOverseasSitesUrl(applicationId)
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
      buildViewData(t, applicationId, session.siteName ?? '', null)
    )
  }
}

export const addInterimSiteNamePostController = {
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
      fallbackUrl: selectOverseasSitesUrl(applicationId)
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
          t('pages.addInterimSite.siteName.validation.required')
        )
      ).code(400)
    }

    setAddInterimSiteSession(request, { siteName })
    return h.redirect(siteLocationUrl(applicationId))
  }
}
