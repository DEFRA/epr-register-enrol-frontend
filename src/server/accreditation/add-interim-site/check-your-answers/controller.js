import { accreditationApiService } from '../../../common/helpers/accreditationApiService.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import { guardInterimSiteLinkedSiteId } from '../../../common/helpers/overseasSiteWizardGuard.js'
import { enterInterimSiteWizardStep } from '../../../common/helpers/addInterimSiteWizardEntry.js'
import {
  getAddInterimSiteSession,
  clearAddInterimSiteSession
} from '../../../common/helpers/addInterimSiteSession.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'

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

function recyclingOperationDetailsUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/recycling-operation-details`
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
    },
    {
      key: t('pages.addInterimSite.cya.rows.recyclingOperation'),
      value: (session.recyclingOperationCodes ?? []).join(', '),
      changeUrl: recyclingOperationDetailsUrl(applicationId),
      testId: 'recycling-operation'
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
    backLink: recyclingOperationDetailsUrl(applicationId),
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
    contactPhone: session.siteContactPhone,
    operationCodes: session.recyclingOperationCodes ?? []
  }
}

// RA-603: edits one interim site through its own endpoint.
//
// This used to read the whole site list, rewrite the targeted ORS's nested
// interimSite and send the entire list back through the bulk patchOverseasSites,
// because there was no dedicated update route. There is now, and it matters
// beyond tidiness: the old shape was a read-modify-write over every site, so a
// concurrent change anywhere else in the list was silently overwritten, and it
// could not express "change this one interim site" once an ORS could hold
// several.
//
// It also means siteNumber no longer has to be carried by hand. The backend
// owns siteId, siteNumber, createdAt and removedAt and ignores them from the
// request body, so an edit can no longer wipe the generated site number by
// forgetting to echo it.
//
// editingInterimSiteId can still point at something that is no longer there - a
// stale session left over from an abandoned Change, or a site withdrawn in
// another tab - so a 404 falls back to creating fresh rather than surfacing an
// error the operator cannot act on.
async function saveInterimSiteEdit(
  organisationId,
  applicationId,
  session,
  sitePayload
) {
  try {
    return await accreditationApiService.updateInterimSite(
      organisationId,
      applicationId,
      session.linkedSiteId,
      session.editingInterimSiteId,
      sitePayload
    )
  } catch (err) {
    if (err.status === statusCodes.notFound) {
      return accreditationApiService.createInterimSite(
        organisationId,
        applicationId,
        session.linkedSiteId,
        sitePayload
      )
    }
    throw err
  }
}

export const addInterimSiteCyaGetController = {
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

    return renderPage(h, buildViewData(t, applicationId, session, null))
  }
}

export const addInterimSiteCyaPostController = {
  async handler(request, h) {
    const { applicationId } = request.params
    const { t, organisationId, guardRedirect } =
      await enterInterimSiteWizardStep({ request, h, applicationId })
    if (guardRedirect) {
      return guardRedirect
    }

    const session = getAddInterimSiteSession(request)
    const sitePayload = buildSitePayload(session)

    try {
      if (session.editingInterimSiteId != null) {
        await saveInterimSiteEdit(
          organisationId,
          applicationId,
          session,
          sitePayload
        )
      } else {
        await accreditationApiService.createInterimSite(
          organisationId,
          applicationId,
          session.linkedSiteId,
          sitePayload
        )
      }
    } catch (err) {
      logStructuredError(
        request.server.logger,
        err,
        {},
        'Interim site CYA createInterimSite error'
      )
      // RA-481: a 409 means the application locked between the guard check
      // above and this write landing — send the operator back to the
      // section's own (now read-only) list page rather than a raw error.
      if (err.status === statusCodes.conflict) {
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
