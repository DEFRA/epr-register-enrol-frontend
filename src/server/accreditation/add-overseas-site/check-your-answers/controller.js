import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  getAddOrsSession,
  clearAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'

const ORS_SUCCESS_FLASH = 'orsSuccess'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-name`
}

function siteLocationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-location`
}

function contactDetailsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-contact-details`
}

function recyclingOperationUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/recycling-operation-details`
}

function baselCodeUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/basel-convention-and-oecd-code`
}

function repatriatedLoadsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/repatriated-loads`
}

function conditionsOfExportUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/conditions-of-export`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/check-your-answers/index',
    viewData
  )
}

function buildRows(t, applicationId, session) {
  const locationParts = [
    session.addressLine1,
    session.addressLine2,
    session.townOrCity,
    session.stateOrRegion,
    session.postcode,
    session.country
  ].filter(Boolean)

  const rows = [
    {
      key: t('pages.addOverseasSite.cya.rows.siteName'),
      value: session.siteName ?? '',
      changeUrl: siteNameUrl(applicationId),
      testId: 'site-name'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.location'),
      value: locationParts.join(', '),
      changeUrl: siteLocationUrl(applicationId),
      testId: 'location'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.contactName'),
      value: session.siteContactName ?? '',
      changeUrl: contactDetailsUrl(applicationId),
      testId: 'contact-name'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.contactEmail'),
      value: session.siteContactEmail ?? '',
      changeUrl: contactDetailsUrl(applicationId),
      testId: 'contact-email'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.contactPhone'),
      value: session.siteContactPhone ?? '',
      changeUrl: contactDetailsUrl(applicationId),
      testId: 'contact-phone'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.recyclingOperation'),
      value: session.recyclingOperationCode ?? '',
      changeUrl: recyclingOperationUrl(applicationId),
      testId: 'recycling-operation'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.baselCode1'),
      value: session.baselConventionCode1 ?? '',
      changeUrl: baselCodeUrl(applicationId),
      testId: 'basel-code-1'
    }
  ]

  if (session.baselConventionCode2) {
    rows.push({
      key: t('pages.addOverseasSite.cya.rows.baselCode2'),
      value: session.baselConventionCode2,
      changeUrl: baselCodeUrl(applicationId),
      testId: 'basel-code-2'
    })
  }

  if (session.baselConventionCode3) {
    rows.push({
      key: t('pages.addOverseasSite.cya.rows.baselCode3'),
      value: session.baselConventionCode3,
      changeUrl: baselCodeUrl(applicationId),
      testId: 'basel-code-3'
    })
  }

  rows.push({
    key: t('pages.addOverseasSite.cya.rows.repatriatedLoads'),
    value: session.repatriatedLoads ?? '',
    changeUrl: repatriatedLoadsUrl(applicationId),
    testId: 'repatriated-loads'
  })

  if (session.conditionsOfExport != null) {
    rows.push({
      key: t('pages.addOverseasSite.cya.rows.conditionsOfExport'),
      value: session.conditionsOfExport ? t('common.yes') : t('common.no'),
      changeUrl: conditionsOfExportUrl(applicationId),
      testId: 'conditions-of-export'
    })
  }

  return rows
}

function buildViewData(t, applicationId, session, error) {
  return {
    pageTitle: t('pages.addOverseasSite.cya.title'),
    heading: t('pages.addOverseasSite.cya.heading'),
    submitButton: t('pages.addOverseasSite.cya.submitButton'),
    cancelLink: t('pages.addOverseasSite.cya.cancelLink'),
    cancelUrl: selectOrsUrl(applicationId),
    rows: buildRows(t, applicationId, session),
    changeLabel: t('pages.addOverseasSite.cya.changeLink'),
    error
  }
}

function nextOrsId(sites) {
  const existingNums = (sites ?? [])
    .map((s) => parseInt(s.orsId ?? '0', 10))
    .filter((n) => !isNaN(n))
  const max = existingNums.length > 0 ? Math.max(...existingNums) : 0
  return String(max + 1).padStart(3, '0')
}

function buildSitePayload(orsId, session) {
  return {
    orsId,
    siteName: session.siteName,
    addressLine1: session.addressLine1,
    addressLine2: session.addressLine2 ?? null,
    townOrCity: session.townOrCity,
    country: session.country,
    coordinates: session.coordinates ?? null,
    contactName: session.siteContactName,
    contactEmail: session.siteContactEmail,
    contactPhone: session.siteContactPhone ?? null,
    operationCode: session.recyclingOperationCode,
    code1: session.baselConventionCode1,
    code2: session.baselConventionCode2 ?? null,
    code3: session.baselConventionCode3 ?? null,
    repatriatedLoads: session.repatriatedLoads,
    conditionsOfExport: session.conditionsOfExport ?? null
  }
}

export const addOrsCyaGetController = {
  handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    return renderPage(h, buildViewData(t, applicationId, session, null))
  }
}

export const addOrsCyaPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const session = getAddOrsSession(request)

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(`CYA getApplication error: ${err.message}`)
      return renderPage(
        h,
        buildViewData(t, applicationId, session, t('common.errorSummaryTitle'))
      ).code(500)
    }

    const orsId = nextOrsId(application.overseasSites?.sites)
    const sitePayload = buildSitePayload(orsId, session)

    try {
      await accreditationApiService.createOverseasSite(
        organisationId,
        applicationId,
        sitePayload
      )
    } catch (err) {
      request.server.logger.error(
        `CYA createOverseasSite error: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(t, applicationId, session, t('common.errorSummaryTitle'))
      ).code(500)
    }

    clearAddOrsSession(request)
    request.yar.flash(ORS_SUCCESS_FLASH, true)
    return h.redirect(selectOrsUrl(applicationId))
  }
}
