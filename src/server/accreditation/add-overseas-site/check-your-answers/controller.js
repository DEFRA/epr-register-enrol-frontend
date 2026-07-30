import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import {
  getAddOrsSession,
  setAddOrsSession,
  clearAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import { setAddInterimSiteSession } from '../../../common/helpers/addInterimSiteSession.js'
import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'

const ORS_SUCCESS_FLASH = 'orsSuccess'

const ADD_INTERIM_SITE_ACTION = 'addInterimSite'
const DELETE_BASEL_CODE_ACTION_PREFIX = 'deleteBaselCode-'

function selectOrsUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function addInterimSiteCountryUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/country`
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

function cyaUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/check-your-answers`
}

function renderPage(h, viewData) {
  return h.view(
    'accreditation/add-overseas-site/check-your-answers/index',
    viewData
  )
}

function buildRows(t, applicationId, session) {
  const rows = [
    {
      key: t('pages.addOverseasSite.cya.rows.siteName'),
      value: session.siteName ?? '',
      changeUrl: siteNameUrl(applicationId),
      testId: 'site-name'
    },
    {
      key: t('pages.addOverseasSite.cya.rows.location'),
      value: formatSiteAddress(session),
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
      key: t('pages.addOverseasSite.cya.rows.baselCodes'),
      type: 'codeList',
      codes: (session.baselAndOecdCodes ?? []).map((value, index) => ({
        value,
        index
      })),
      changeUrl: baselCodeUrl(applicationId),
      testId: 'basel-codes'
    }
  ]

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
    addInterimSiteButton: t('pages.addOverseasSite.cya.addInterimSiteButton'),
    cancelLink: t('pages.addOverseasSite.cya.cancelLink'),
    cancelUrl: selectOrsUrl(applicationId),
    rows: buildRows(t, applicationId, session),
    changeLabel: t('pages.addOverseasSite.cya.changeLink'),
    removeCodeLabel: t('pages.addOverseasSite.cya.removeCode'),
    noCodesEnteredLabel: t('pages.addOverseasSite.cya.noCodesEntered'),
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
  const codes = session.baselAndOecdCodes ?? []
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
    code1: codes[0] ?? null,
    code2: codes[1] ?? null,
    code3: codes[2] ?? null,
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
    const { applicationId } = request.params
    const session = getAddOrsSession(request)
    const action = request.payload?.action ?? ''

    if (action.startsWith(DELETE_BASEL_CODE_ACTION_PREFIX)) {
      const codeIndex = parseInt(
        action.replace(DELETE_BASEL_CODE_ACTION_PREFIX, ''),
        10
      )
      const codes = [...(session.baselAndOecdCodes ?? [])]
      if (
        !Number.isNaN(codeIndex) &&
        codeIndex >= 0 &&
        codeIndex < codes.length
      ) {
        codes.splice(codeIndex, 1)
        setAddOrsSession(request, { baselAndOecdCodes: codes })
      }
      return h.redirect(cyaUrl(applicationId))
    }

    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )

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

    let createdSite
    try {
      createdSite = await accreditationApiService.createOverseasSite(
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

    if (request.payload?.action === ADD_INTERIM_SITE_ACTION) {
      setAddInterimSiteSession(request, { linkedSiteId: createdSite?.siteId })
      return h.redirect(addInterimSiteCountryUrl(applicationId))
    }

    request.yar.flash(ORS_SUCCESS_FLASH, true)
    return h.redirect(selectOrsUrl(applicationId))
  }
}
