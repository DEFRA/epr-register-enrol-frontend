import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
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
const ORS_EDIT_SUCCESS_FLASH = 'orsEditSuccess'

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

// RA-482: shared by both createOverseasSite and promoteOverseasSite -- their payload shapes
// converged once orsId (the one field that differed) moved to server-side generation.
// Promoting a registered site keeps its existing orsId/siteId server-side either way, so
// this payload never carries them for that path either.
function buildSitePayload(session) {
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

// Extracted from addOrsCyaPostController (SonarCloud cognitive complexity):
// pulls the "delete one Basel/OECD code row" action fully out of the POST
// handler's own branching, since it's a self-contained session mutation with
// no dependency on the rest of the handler's flow.
function handleDeleteBaselCode(request, h, session, action, applicationId) {
  const codeIndex = Number.parseInt(
    action.replace(DELETE_BASEL_CODE_ACTION_PREFIX, ''),
    10
  )
  const codes = [...(session.baselAndOecdCodes ?? [])]
  if (!Number.isNaN(codeIndex) && codeIndex >= 0 && codeIndex < codes.length) {
    codes.splice(codeIndex, 1)
    setAddOrsSession(request, { baselAndOecdCodes: codes })
  }
  return h.redirect(cyaUrl(applicationId))
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

// editingSiteId and promotingSiteId are never both set -- resetAddOrsSession clears the wizard
// session before either entry point seeds its own key -- so these are mutually exclusive. Each
// mode's API method and success-flash key are resolved once here, rather than re-derived
// separately for the API call, the error log label, and the flash key.
const SITE_SAVE_MODES = {
  editing: {
    apiMethod: 'updateOverseasSite',
    successFlash: ORS_EDIT_SUCCESS_FLASH
  },
  promoting: {
    apiMethod: 'promoteOverseasSite',
    successFlash: ORS_PROMOTE_SUCCESS_FLASH
  },
  creating: {
    apiMethod: 'createOverseasSite',
    successFlash: ORS_SUCCESS_FLASH
  }
}

function resolveSiteSaveMode(session) {
  if (session.editingSiteId != null) {
    return 'editing'
  }
  if (session.promotingSiteId != null) {
    return 'promoting'
  }
  return 'creating'
}

async function saveSite(mode, session, organisationId, applicationId) {
  const payload = buildSitePayload(session)
  if (mode === 'editing') {
    return accreditationApiService.updateOverseasSite(
      organisationId,
      applicationId,
      session.editingSiteId,
      payload
    )
  }
  if (mode === 'promoting') {
    return accreditationApiService.promoteOverseasSite(
      organisationId,
      applicationId,
      session.promotingSiteId,
      payload
    )
  }
  // RA-482: orsId is generated server-side now -- savedSite (read from the response below)
  // carries the id the server assigned, so there is nothing to compute here.
  return accreditationApiService.createOverseasSite(
    organisationId,
    applicationId,
    payload
  )
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
      return handleDeleteBaselCode(request, h, session, action, applicationId)
    }

    const { t } = getLocaleAndTranslator(request)

    if (requiresInterimSite(session) && action !== ADD_INTERIM_SITE_ACTION) {
      return renderPage(h, buildViewData(t, applicationId, session, null)).code(
        400
      )
    }

    const mode = resolveSiteSaveMode(session)

    let savedSite
    try {
      savedSite = await saveSite(mode, session, organisationId, applicationId)
    } catch (err) {
      request.server.logger.error(
        `CYA ${SITE_SAVE_MODES[mode].apiMethod} error: ${err.message}`
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to the
      // section's own (now read-only) list page rather than a raw error.
      if (err.status === statusCodes.conflict) {
        return h.redirect(selectOrsUrl(applicationId))
      }
      return renderPage(
        h,
        buildViewData(t, applicationId, session, t('common.errorSummaryTitle'))
      ).code(500)
    }

    clearAddOrsSession(request)

    if (action === ADD_INTERIM_SITE_ACTION) {
      setAddInterimSiteSession(request, { linkedSiteId: savedSite?.siteId })
      return h.redirect(addInterimSiteCountryUrl(applicationId))
    }

    request.yar.flash(SITE_SAVE_MODES[mode].successFlash, true)
    return h.redirect(selectOrsUrl(applicationId))
  }
}
