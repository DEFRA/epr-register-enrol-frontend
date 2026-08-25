import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { guardOverseasSiteWizardEntry } from '../../../common/helpers/overseasSiteWizardGuard.js'
import {
  getAddOrsSession,
  setAddOrsSession,
  clearAddOrsSession
} from '../../../common/helpers/addOverseasSiteSession.js'
import { setAddInterimSiteSession } from '../../../common/helpers/addInterimSiteSession.js'
import { formatSiteAddress } from '../../../common/helpers/formatSiteAddress.js'

const ORS_SUCCESS_FLASH = 'orsSuccess'
const ORS_PROMOTE_SUCCESS_FLASH = 'orsPromoteSuccess'

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
      value: (session.recyclingOperationCodes ?? []).join(', '),
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

function requiresInterimSite(session) {
  const codes = session.recyclingOperationCodes ?? []
  return codes.includes('R12') || codes.includes('R13')
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
    requiresInterimSite: requiresInterimSite(session),
    error
  }
}

function nextOrsId(sites) {
  const existingNums = (sites ?? [])
    .map((s) => Number.parseInt(s.orsId ?? '0', 10))
    .filter((n) => !Number.isNaN(n))
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
    operationCodes: session.recyclingOperationCodes ?? [],
    code1: codes[0] ?? null,
    code2: codes[1] ?? null,
    code3: codes[2] ?? null,
    repatriatedLoads: session.repatriatedLoads,
    conditionsOfExport: session.conditionsOfExport ?? null
  }
}

// Promoting a registered site keeps its existing orsId/siteId server-side, so the payload
// omits them — matches the backend's PromoteOverseasSiteRequest shape (AddOverseasSiteRequest
// minus orsId).
function buildPromotePayload(session) {
  const codes = session.baselAndOecdCodes ?? []
  return {
    siteName: session.siteName,
    addressLine1: session.addressLine1,
    addressLine2: session.addressLine2 ?? null,
    townOrCity: session.townOrCity,
    country: session.country,
    coordinates: session.coordinates ?? null,
    contactName: session.siteContactName,
    contactEmail: session.siteContactEmail,
    contactPhone: session.siteContactPhone ?? null,
    operationCodes: session.recyclingOperationCodes ?? [],
    code1: codes[0] ?? null,
    code2: codes[1] ?? null,
    code3: codes[2] ?? null,
    repatriatedLoads: session.repatriatedLoads,
    conditionsOfExport: session.conditionsOfExport ?? null
  }
}

export const addOrsCyaGetController = {
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
    return renderPage(h, buildViewData(t, applicationId, session, null))
  }
}

export const addOrsCyaPostController = {
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

    const session = getAddOrsSession(request)
    const action = request.payload?.action ?? ''

    if (action.startsWith(DELETE_BASEL_CODE_ACTION_PREFIX)) {
      const codeIndex = Number.parseInt(
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

    if (requiresInterimSite(session) && action !== ADD_INTERIM_SITE_ACTION) {
      return renderPage(h, buildViewData(t, applicationId, session, null)).code(
        400
      )
    }

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

    const isPromoting = session.promotingSiteId != null

    let createdSite
    try {
      if (isPromoting) {
        createdSite = await accreditationApiService.promoteOverseasSite(
          organisationId,
          applicationId,
          session.promotingSiteId,
          buildPromotePayload(session)
        )
      } else {
        const orsId = nextOrsId(application.overseasSites?.sites)
        createdSite = await accreditationApiService.createOverseasSite(
          organisationId,
          applicationId,
          buildSitePayload(orsId, session)
        )
      }
    } catch (err) {
      request.server.logger.error(
        `CYA ${isPromoting ? 'promoteOverseasSite' : 'createOverseasSite'} error: ${err.message}`
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to the
      // section's own (now read-only) list page rather than a raw error.
      if (err.status === 409) {
        return h.redirect(selectOrsUrl(applicationId))
      }
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

    request.yar.flash(
      isPromoting ? ORS_PROMOTE_SUCCESS_FLASH : ORS_SUCCESS_FLASH,
      true
    )
    return h.redirect(selectOrsUrl(applicationId))
  }
}
