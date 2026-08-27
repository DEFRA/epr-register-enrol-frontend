import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'
import { COUNTRIES } from '../../../common/data/countries.js'

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-name`
}

function renderPage(h, viewData) {
  return h.view('accreditation/add-interim-site/country/index', viewData)
}

function buildViewData(t, applicationId, country, error) {
  return {
    pageTitle: t('pages.addInterimSite.country.title'),
    heading: t('pages.addInterimSite.country.heading'),
    hint: t('pages.addInterimSite.country.hint'),
    continueButton: t('pages.addInterimSite.country.continueButton'),
    cancelLink: t('pages.addInterimSite.country.cancelLink'),
    country,
    countries: COUNTRIES,
    backLink: selectOverseasSitesUrl(applicationId),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    error
  }
}

export const addInterimSiteCountryGetController = {
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
      buildViewData(t, applicationId, session.country ?? '', null)
    )
  }
}

export const addInterimSiteCountryPostController = {
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

    const country = (request.payload?.country ?? '').trim()

    if (!country) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          '',
          t('pages.addInterimSite.country.validation.required')
        )
      ).code(400)
    }

    setAddInterimSiteSession(request, { country })
    return h.redirect(siteNameUrl(applicationId))
  }
}

export const addInterimSiteCancelController = {
  handler(request, h) {
    const { applicationId } = request.params
    request.yar.clear(ACCREDITATION_SESSION_KEYS.addInterimSite)
    return h.redirect(selectOverseasSitesUrl(applicationId))
  }
}
