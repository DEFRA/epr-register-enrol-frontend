import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddInterimSiteSession,
  clearAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'

export const INTERIM_SITE_SUCCESS_FLASH = 'interimSiteSuccess'

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function countryUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/country`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-name`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-location`
}

function siteContactDetailsUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/site-contact-details`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-interim-site/check-your-answers/index',
    viewData
  )
}

function buildRows(t, applicationId, session) {
  const locationParts = [
    session.addressLine1,
    session.addressLine2,
    session.townOrCity,
    session.stateOrRegion,
    session.postcode
  ].filter(Boolean)

  const rows = [
    {
      key: t('pages.addInterimSite.cya.rows.country'),
      value: session.country ?? '',
      changeUrl: countryUrl(applicationId),
      testId: 'country'
    },
    {
      key: t('pages.addInterimSite.cya.rows.siteName'),
      value: session.siteName ?? '',
      changeUrl: siteNameUrl(applicationId),
      testId: 'site-name'
    },
    {
      key: t('pages.addInterimSite.cya.rows.location'),
      value: locationParts.join(', '),
      changeUrl: siteLocationUrl(applicationId),
      testId: 'location'
    },
    {
      key: t('pages.addInterimSite.cya.rows.contactName'),
      value: session.siteContactName ?? '',
      changeUrl: siteContactDetailsUrl(applicationId),
      testId: 'contact-name'
    },
    {
      key: t('pages.addInterimSite.cya.rows.contactEmail'),
      value: session.siteContactEmail ?? '',
      changeUrl: siteContactDetailsUrl(applicationId),
      testId: 'contact-email'
    },
    {
      key: t('pages.addInterimSite.cya.rows.contactPhone'),
      value: session.siteContactPhone ?? '',
      changeUrl: siteContactDetailsUrl(applicationId),
      testId: 'contact-phone'
    }
  ]

  // Site Number is backend-generated once the interim site is created; the
  // current flow always redirects away on success rather than re-rendering
  // this page, but the row is included defensively should that ever change.
  if (session.siteNumber) {
    rows.push({
      key: t('pages.addInterimSite.cya.rows.siteNumber'),
      value: session.siteNumber,
      changeUrl: null,
      testId: 'site-number'
    })
  }

  return rows
}

function buildViewData(t, applicationId, session, error) {
  return {
    pageTitle: t('pages.addInterimSite.cya.title'),
    heading: t('pages.addInterimSite.cya.heading'),
    submitButton: t('pages.addInterimSite.cya.submitButton'),
    cancelLink: t('pages.addInterimSite.cya.cancelLink'),
    cancelUrl: selectOverseasSitesUrl(applicationId),
    rows: buildRows(t, applicationId, session),
    changeLabel: t('pages.addInterimSite.cya.changeLink'),
    error
  }
}

function buildSitePayload(session) {
  return {
    country: session.country,
    siteName: session.siteName,
    addressLine1: session.addressLine1,
    addressLine2: session.addressLine2 ?? null,
    townOrCity: session.townOrCity,
    stateOrRegion: session.stateOrRegion ?? null,
    postcode: session.postcode ?? null,
    contactName: session.siteContactName,
    contactEmail: session.siteContactEmail,
    contactPhone: session.siteContactPhone
  }
}

export const addInterimSiteCyaGetController = {
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
    return renderPage(h, buildViewData(t, applicationId, session, null))
  }
}

export const addInterimSiteCyaPostController = {
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
    const sitePayload = buildSitePayload(session)

    try {
      await accreditationApiService.createInterimSite(
        organisationId,
        applicationId,
        session.linkedSiteId,
        sitePayload
      )
    } catch (err) {
      request.server.logger.error(
        `Interim site CYA createInterimSite error: ${err.message}`
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to the
      // section's own (now read-only) list page rather than a raw error.
      if (err.status === 409) {
        return h.redirect(selectOverseasSitesUrl(applicationId))
      }
      return renderPage(
        h,
        buildViewData(t, applicationId, session, t('common.errorSummaryTitle'))
      ).code(500)
    }

    clearAddInterimSiteSession(request)
    request.yar.flash(INTERIM_SITE_SUCCESS_FLASH, true)
    return h.redirect(selectOverseasSitesUrl(applicationId))
  }
}
