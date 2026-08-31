import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resetAddOrsSession,
  setAddOrsSession
} from '../../common/helpers/addOverseasSiteSession.js'
import {
  resetAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../common/helpers/addInterimSiteSession.js'

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
async function loadSiteForWizardEntry(request, h) {
  const organisationId = request.yar.get(
    ACCREDITATION_SESSION_KEYS.organisationId
  )
  const { applicationId, siteId } = request.params

  let application
  try {
    application = await accreditationApiService.getApplication(
      organisationId,
      applicationId
    )
  } catch (err) {
    request.server.logger.error(
      { applicationId, err },
      `Error fetching application ${applicationId}`
    )
    return { redirect: h.redirect(selectOverseasSitesUrl(applicationId)) }
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

  return { applicationId, site }
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

export const selectOverseasSitesInterimSiteEditEntryGetController = {
  async handler(request, h) {
    const { redirect, applicationId, site } = await loadSiteForWizardEntry(
      request,
      h
    )
    if (redirect) {
      return redirect
    }

    if (!site.interimSite) {
      return h.redirect(selectOverseasSitesUrl(applicationId))
    }

    resetAddInterimSiteSession(request)
    setAddInterimSiteSession(request, {
      ...buildInterimSiteSessionSeed(site.interimSite),
      linkedSiteId: site.siteId,
      editingInterimSiteId: site.interimSite.siteId
    })

    return h.redirect(interimSiteCountryUrl(applicationId))
  }
}
