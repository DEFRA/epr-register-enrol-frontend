import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'
import { validateInterimSiteName } from '../../../common/helpers/interimSiteValidation.js'
import { statusCodes } from '../../../common/constants/status-codes.js'

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
      buildViewData(t, applicationId, session.siteName ?? '', null)
    )
  }
}

export const addInterimSiteNamePostController = {
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

    const siteName = (request.payload?.siteName ?? '').trim()

    const error = validateInterimSiteName(t, siteName)
    if (error) {
      return renderPage(
        h,
        buildViewData(t, applicationId, siteName, error)
      ).code(statusCodes.badRequest)
    }

    setAddInterimSiteSession(request, { siteName })
    return h.redirect(siteLocationUrl(applicationId))
  }
}
