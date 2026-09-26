import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { findInterimSite } from '../../common/helpers/interimSites.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resetAddOrsSession,
  setAddOrsSession
} from '../../common/helpers/addOverseasSiteSession.js'
import {
  resetAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../common/helpers/addInterimSiteSession.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

// Split out of controller.js (RA-486 self-review, SonarCloud S104: that file
// had grown past the 500-line limit) — these three "Change"/"Add To
// Accreditation" entry points all replay an existing site's data into a
// fresh wizard session and hand off to that wizard's first step, which is a
// distinct concern from the list/remove/save-for-later handling that stayed
// behind in controller.js.

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-name`
}

function interimSiteCountryUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/country`
}

// Mirrors the check controller.js's POST handler already applies to every
// write action (removeAccredited/deleteNewSite/revertAccreditation/continue):
// once the application is Queried, this section can only be written to while
// it's the section under query -- otherwise, even a section that's still
// viewable read-only (Completed/Submitted) must not accept writes. Shared
// with the promote/edit wizard entry points below, since starting either
// wizard is itself the first step of a write.
function isOverseasSitesSectionWriteBlocked(application) {
  return (
    application.applicationStatus === 'Queried' &&
    application.overseasSites?.sectionStatus !== 'Queried'
  )
}

// Shared by the promote-entry and edit-entry controllers below: fetches the application,
// applies the entry guard, and looks up the site by id. Returns { redirect } (an
// already-built h.redirect response) when any of those steps fail, so callers can bail out
// with a single check; otherwise returns { applicationId, site }.
// RA-603: the interim-site edit route names an interim site, not an ORS, so it
// needs the application without a {siteId} param to resolve against.
async function loadApplicationForWizardEntry(request, h) {
  const organisationId = request.yar.get(
    ACCREDITATION_SESSION_KEYS.organisationId
  )
  const { applicationId } = request.params

  const { application, errorResponse } = await fetchApplicationOrRenderError({
    request,
    organisationId,
    applicationId,
    renderErrorResponse: () => ({
      redirect: h.redirect(selectOverseasSitesUrl(applicationId))
    })
  })
  if (errorResponse) {
    return errorResponse
  }

  if (isOverseasSitesSectionWriteBlocked(application)) {
    return { redirect: h.redirect(queryTaskListUrl(applicationId)) }
  }

  return { applicationId, application }
}

async function loadSiteForWizardEntry(request, h) {
  const organisationId = request.yar.get(
    ACCREDITATION_SESSION_KEYS.organisationId
  )
  const { applicationId, siteId } = request.params

  const { application, errorResponse } = await fetchApplicationOrRenderError({
    request,
    organisationId,
    applicationId,
    renderErrorResponse: () => ({
      redirect: h.redirect(selectOverseasSitesUrl(applicationId))
    })
  })
  if (errorResponse) {
    return errorResponse
  }

  if (isOverseasSitesSectionWriteBlocked(application)) {
    return { redirect: h.redirect(queryTaskListUrl(applicationId)) }
  }

  const siteIdInt = Number.parseInt(siteId, 10)
  const site = application.overseasSites?.sites?.find(
    (s) => s.siteId === siteIdInt
  )
  if (!site) {
    return { redirect: h.redirect(selectOverseasSitesUrl(applicationId)) }
  }

  return { applicationId, site, application }
}

// Shared by the promote-entry and edit-entry controllers below: the wizard-session fields
// common to both journeys, keyed off the existing site (mirrors the buildSitePayload precedent
// in add-overseas-site/check-your-answers/controller.js, which the same RA-482 change
// extracted for the same reason -- create/promote/update all shape this data identically, so
// only the id key that ties the session back to the site on submit differs per entry point).
// [sessionField, siteField, fallback] rather than a `??`-per-line object literal — a chain of
// that many nullish-coalescing operators in one expression trips SonarCloud's cyclomatic-
// complexity gate even though there's no real branching here, just a flat field-by-field default.
const ORS_SESSION_SEED_FIELDS = [
  ['siteName', 'siteName', ''],
  ['addressLine1', 'addressLine1', ''],
  ['addressLine2', 'addressLine2', ''],
  ['townOrCity', 'townOrCity', ''],
  ['country', 'country', ''],
  ['coordinates', 'coordinates', ''],
  ['siteContactName', 'contactName', ''],
  ['siteContactEmail', 'contactEmail', ''],
  ['siteContactPhone', 'contactPhone', ''],
  ['recyclingOperationCodes', 'operationCodes', []],
  ['repatriatedLoads', 'repatriatedLoads', ''],
  ['conditionsOfExport', 'conditionsOfExport', null]
]

function buildOrsSessionSeed(site) {
  const seed = ORS_SESSION_SEED_FIELDS.reduce(
    (acc, [sessionField, siteField, fallback]) => {
      acc[sessionField] = site[siteField] ?? fallback
      return acc
    },
    {}
  )
  seed.baselAndOecdCodes = [site.code1, site.code2, site.code3].filter(Boolean)
  return seed
}

// Entry point for the Registered section's "Add To Accreditation" button — seeds the
// add-overseas-site wizard session from an existing registered site's known fields (mirrors
// the linkedSiteId precedent used to seed the add-interim-site wizard from check-your-answers)
// then hands off to the wizard's first step. check-your-answers reads promotingSiteId back off
// the session to call promoteOverseasSite instead of createOverseasSite on submit.
export const selectOverseasSitesPromoteEntryGetController = {
  async handler(request, h) {
    const { redirect, applicationId, site } = await loadSiteForWizardEntry(
      request,
      h
    )
    if (redirect) {
      return redirect
    }

    resetAddOrsSession(request)
    setAddOrsSession(request, {
      ...buildOrsSessionSeed(site),
      promotingSiteId: site.siteId
    })

    return h.redirect(siteNameUrl(applicationId))
  }
}

// Entry point for the "Change" link on an already-accredited/new/registered-added site —
// seeds the add-overseas-site wizard session from that site's existing data and replays the
// same wizard, keyed by editingSiteId instead of promotingSiteId. check-your-answers reads
// editingSiteId back off the session to call updateOverseasSite (PATCH) instead of
// promoteOverseasSite/createOverseasSite on submit.
export const selectOverseasSitesEditEntryGetController = {
  async handler(request, h) {
    const { redirect, applicationId, site } = await loadSiteForWizardEntry(
      request,
      h
    )
    if (redirect) {
      return redirect
    }

    resetAddOrsSession(request)
    setAddOrsSession(request, {
      ...buildOrsSessionSeed(site),
      editingSiteId: site.siteId
    })

    return h.redirect(siteNameUrl(applicationId))
  }
}

// RA-486: "Change" entry point for an interim site already attached to an ORS. Reuses the
// add-interim-site wizard (keyed by editingInterimSiteId instead of the create-flow's absent
// id) so the same steps and validation apply to an edit as to a fresh add. The backend has no
// dedicated update endpoint for an interim site's own fields -- editing goes out the same bulk
// patchOverseasSites path as removeInterimSite in controller.js, just with an edited interimSite
// object instead of null, keyed on the unchanged interimSite siteId (per backend RA-486
// confirmation).
// Maps each session field to the interim site's source field — most names
// match, but the contact fields are prefixed `site` in session and the
// wizard's own operation-codes key differs from the wire's `operationCodes`.
const INTERIM_SITE_SESSION_FIELDS = {
  country: 'country',
  siteName: 'siteName',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  townOrCity: 'townOrCity',
  stateOrRegion: 'stateOrRegion',
  postcode: 'postcode',
  siteContactName: 'contactName',
  siteContactEmail: 'contactEmail',
  siteContactPhone: 'contactPhone'
}

function buildInterimSiteSessionSeed(interimSite) {
  const seed = {}
  for (const [sessionKey, sourceKey] of Object.entries(
    INTERIM_SITE_SESSION_FIELDS
  )) {
    seed[sessionKey] = interimSite[sourceKey] ?? ''
  }
  seed.recyclingOperationCodes = interimSite.operationCodes ?? []
  return seed
}

/**
 * RA-603: edits ONE interim site, addressed by its own id.
 *
 * This route used to take the parent ORS id and edit whatever single interim
 * site hung off it. That stops being a question with an answer once an ORS can
 * hold several, so the route now names the interim site directly. Interim ids
 * are unique application-wide — the backend allocates ORS and interim ids from
 * one sequence — so the parent is derived rather than passed, and a URL cannot
 * name a valid interim site against the wrong ORS.
 *
 * A withdrawn interim site is not editable: restoring it is a separate,
 * deliberate action, and the backend refuses the edit anyway.
 */
export const selectOverseasSitesInterimSiteEditEntryGetController = {
  async handler(request, h) {
    const { redirect, applicationId, application } =
      await loadApplicationForWizardEntry(request, h)
    if (redirect) {
      return redirect
    }

    const interimSiteId = Number.parseInt(request.params.interimSiteId, 10)
    const found = findInterimSite(
      application.overseasSites?.sites,
      interimSiteId
    )
    if (!found || found.interimSite.removedAt != null) {
      return h.redirect(selectOverseasSitesUrl(applicationId))
    }

    resetAddInterimSiteSession(request)
    setAddInterimSiteSession(request, {
      ...buildInterimSiteSessionSeed(found.interimSite),
      linkedSiteId: found.site.siteId,
      editingInterimSiteId: found.interimSite.siteId
    })

    return h.redirect(interimSiteCountryUrl(applicationId))
  }
}

/**
 * RA-603 AC01: starts a NEW interim site against an existing ORS.
 *
 * Until now the only way into the interim wizard was "Save and add interim
 * site" on the ORS check-your-answers page, which is reachable only while
 * adding or editing the ORS itself. Adding a second interim site later needs
 * its own entry point, and it has to clear `editingInterimSiteId` — a leftover
 * from an abandoned edit would otherwise turn this into an overwrite of that
 * site rather than a new one.
 */
export const selectOverseasSitesInterimSiteAddEntryGetController = {
  async handler(request, h) {
    const { redirect, applicationId, site } = await loadSiteForWizardEntry(
      request,
      h
    )
    if (redirect) {
      return redirect
    }

    resetAddInterimSiteSession(request)
    setAddInterimSiteSession(request, { linkedSiteId: site.siteId })

    return h.redirect(interimSiteCountryUrl(applicationId))
  }
}
