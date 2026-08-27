import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import {
  resetAddOrsSession,
  setAddOrsSession
} from '../../common/helpers/addOverseasSiteSession.js'
import {
  resetAddInterimSiteSession,
  setAddInterimSiteSession
} from '../../common/helpers/addInterimSiteSession.js'

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function selectOverseasSitesUrl(applicationId) {
  return `/accreditation/select-overseas-sites/${applicationId}`
}

function confirmOverseasSitesUrl(applicationId) {
  return `/accreditation/confirm-overseas-sites/${applicationId}`
}

function promoteUrl(applicationId, siteId) {
  return `/accreditation/select-overseas-sites/${applicationId}/promote/${siteId}`
}

function editUrl(applicationId, siteId) {
  return `/accreditation/select-overseas-sites/${applicationId}/edit/${siteId}`
}

function siteNameUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/site-name`
}

function interimSiteCountryUrl(applicationId) {
  return `/accreditation/add-interim-site/${applicationId}/country`
}

function renderPage(h, viewData) {
  return h.view('accreditation/select-overseas-sites/index', viewData)
}

// Routes through the wizard's reset-and-start entry point rather than straight to site-name,
// so a promotingSiteId left over from an abandoned "Add To Accreditation" attempt can't leak
// into this fresh "Add new overseas reprocessing site" journey.
function addOrsUrl(applicationId) {
  return `/accreditation/add-overseas-site/${applicationId}/new`
}

const ORS_SUCCESS_FLASH = 'orsSuccess'
const INTERIM_SITE_SUCCESS_FLASH = 'interimSiteSuccess'
const ORS_PROMOTE_SUCCESS_FLASH = 'orsPromoteSuccess'
const ORS_EDIT_SUCCESS_FLASH = 'orsEditSuccess'

// Mirrors the check the POST handler below already applies to every write
// action (removeAccredited/deleteNewSite/revertAccreditation/continue):
// once the application is Queried, this section can only be written to
// while it's the section under query -- otherwise, even a section that's
// still viewable read-only (Completed/Submitted) must not accept writes.
// Shared with the promote/edit wizard entry points, since starting either
// wizard is itself the first step of a write.
function isOverseasSitesSectionWriteBlocked(application) {
  return (
    application.applicationStatus === 'Queried' &&
    application.overseasSites?.sectionStatus !== 'Queried'
  )
}

// Partitions the flat sites array into the four display sections. Membership is a strict
// partition given how the flags are set: new sites always start selected:true, promoted
// sites always have selected:true, so only a plain "registered only" site has selected:false.
function partitionSites(rawSites) {
  const sections = {
    newSites: [],
    registeredSitesAdded: [],
    accredited: [],
    registered: []
  }
  for (const site of rawSites ?? []) {
    if (site.isNewSite) {
      sections.newSites.push(site)
    } else if (site.registeredNowAccredited) {
      sections.registeredSitesAdded.push(site)
    } else if (site.selected !== false) {
      sections.accredited.push(site)
    } else {
      sections.registered.push(site)
    }
  }
  return sections
}

function interimSiteEditUrl(applicationId, siteId) {
  return `/accreditation/select-overseas-sites/${applicationId}/interim-site/edit/${siteId}`
}

function withEditUrl(applicationId, sites) {
  return sites.map((site) => ({
    ...site,
    editUrl: editUrl(applicationId, site.siteId),
    interimSiteEditUrl: interimSiteEditUrl(applicationId, site.siteId)
  }))
}

// Extracted from buildViewData (SonarCloud cognitive complexity): the ?? defaulting for
// each banner/flash flag was pushing buildViewData itself over the complexity threshold.
function resolveBannerDefaults(banners) {
  return {
    successBanner: banners.successBanner ?? false,
    queryNote: banners.queryNote ?? null,
    interimSiteSuccessBanner: banners.interimSiteSuccessBanner ?? false,
    promoteSuccessBanner: banners.promoteSuccessBanner ?? false,
    editSuccessBanner: banners.editSuccessBanner ?? false,
    querySummary: banners.querySummary ?? null,
    regulatorQueryFields: banners.regulatorQueryFields ?? null,
    readOnly: banners.readOnly ?? false,
    isQueriedApplication: banners.isQueriedApplication ?? false
  }
}

function buildViewData(t, applicationId, sections, error, banners = {}) {
  return {
    pageTitle: t('pages.selectOverseasSites.title'),
    heading: t('pages.selectOverseasSites.heading'),
    accreditedSites: withEditUrl(applicationId, sections.accredited),
    registeredSites: sections.registered.map((site) => ({
      ...site,
      promoteUrl: promoteUrl(applicationId, site.siteId),
      interimSiteEditUrl: interimSiteEditUrl(applicationId, site.siteId)
    })),
    newSites: withEditUrl(applicationId, sections.newSites),
    registeredSitesAddedSites: withEditUrl(
      applicationId,
      sections.registeredSitesAdded
    ),
    // RA-481: only route back to the query task list while the application
    // itself is mid-query — a locked-but-not-queried application is
    // read-only for a different reason and belongs back on the ordinary
    // task list, which renders read-only in that case too.
    backLink: banners.isQueriedApplication
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    addOrsUrl: addOrsUrl(applicationId),
    error,
    ...resolveBannerDefaults(banners)
  }
}

// Shared by every mutating POST branch's catch block below, so the error
// copy/status code lives in one place rather than being repeated per branch.
function renderSaveError(h, t, applicationId, rawSites) {
  return renderPage(
    h,
    buildViewData(
      t,
      applicationId,
      partitionSites(rawSites),
      t('pages.selectOverseasSites.validation.saveError')
    )
  ).code(500)
}

// The three mutating POST actions below are split out of
// selectOverseasSitesPostController.handler to keep its cyclomatic
// complexity/line count under SonarCloud's per-function thresholds. Each
// takes the request-scoped { h, t, logger } bundled as one `ctx` object
// rather than three separate parameters, to stay under the max-params limit
// too.

async function removeOrDeleteSite(
  ctx,
  organisationId,
  applicationId,
  rawSites,
  submitAction,
  siteId
) {
  const { h, t, logger, request } = ctx
  const siteIdInt = Number.parseInt(siteId, 10)
  const updatedSites =
    submitAction === 'deleteNewSite'
      ? rawSites.filter((s) => s.siteId !== siteIdInt)
      : rawSites.map((s) =>
          s.siteId === siteIdInt ? { ...s, selected: false } : s
        )

  try {
    await accreditationApiService.patchOverseasSites(
      organisationId,
      applicationId,
      { sites: updatedSites }
    )
  } catch (err) {
    logger.error(
      `Error updating overseas site ${siteId} on ${applicationId}: ${err.message}`
    )
    // RA-481: a 409 means the application locked between the guard check
    // in the handler and this write landing — send the operator back to
    // the same page so it re-fetches and renders the section read-only.
    if (err.status === statusCodes.conflict) {
      return h.redirect(request.path)
    }
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(selectOverseasSitesUrl(applicationId))
}

// RA-486: clears an interim site from its parent ORS. Reuses the same bulk
// patchOverseasSites endpoint as removeOrDeleteSite above — the backend
// merges a null `interimSite` on the targeted site as a clean detach, with
// no other field side effects (confirmed against OverseasSiteMerge.cs).
async function removeInterimSite(
  ctx,
  organisationId,
  applicationId,
  rawSites,
  siteId
) {
  const { h, t, logger, request } = ctx
  const siteIdInt = Number.parseInt(siteId, 10)
  const updatedSites = rawSites.map((s) =>
    s.siteId === siteIdInt ? { ...s, interimSite: null } : s
  )

  try {
    await accreditationApiService.patchOverseasSites(
      organisationId,
      applicationId,
      { sites: updatedSites }
    )
  } catch (err) {
    logger.error(
      `Error removing interim site from overseas site ${siteId} on ${applicationId}: ${err.message}`
    )
    // RA-481: a 409 means the application locked between the guard check
    // in the handler and this write landing — send the operator back to
    // the same page so it re-fetches and renders the section read-only.
    if (err.status === statusCodes.conflict) {
      return h.redirect(request.path)
    }
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(selectOverseasSitesUrl(applicationId))
}

async function saveOverseasSitesForLater(
  ctx,
  organisationId,
  applicationId,
  rawSites
) {
  const { h, t, logger, request } = ctx
  try {
    await accreditationApiService.patchOverseasSites(
      organisationId,
      applicationId,
      { sectionStatus: 'InProgress' }
    )
  } catch (err) {
    logger.error(
      `Error saving overseas sites for ${applicationId}: ${err.message}`
    )
    // RA-481: a 409 means the application locked between the guard check
    // in the handler and this write landing — send the operator back to
    // the same page so it re-fetches and renders the section read-only.
    if (err.status === statusCodes.conflict) {
      return h.redirect(request.path)
    }
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(taskListUrl(applicationId))
}

async function revertSiteAccreditation(
  ctx,
  organisationId,
  applicationId,
  rawSites,
  siteId
) {
  const { h, t, logger, request } = ctx
  try {
    await accreditationApiService.revertOverseasSite(
      organisationId,
      applicationId,
      Number.parseInt(siteId, 10)
    )
  } catch (err) {
    logger.error(
      `Error reverting overseas site ${siteId} on ${applicationId}: ${err.message}`
    )
    // RA-481: a 409 means the application locked between the guard check
    // in the handler and this write landing — send the operator back to
    // the same page so it re-fetches and renders the section read-only.
    if (err.status === statusCodes.conflict) {
      return h.redirect(request.path)
    }
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(selectOverseasSitesUrl(applicationId))
}

export const selectOverseasSitesGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          partitionSites([]),
          t('pages.selectOverseasSites.loadError')
        )
      ).code(500)
    }

    const successBanner = !!(request.yar.flash(ORS_SUCCESS_FLASH) ?? []).length
    const interimSiteSuccessBanner = !!(
      request.yar.flash(INTERIM_SITE_SUCCESS_FLASH) ?? []
    ).length
    const promoteSuccessBanner = !!(
      request.yar.flash(ORS_PROMOTE_SUCCESS_FLASH) ?? []
    ).length
    const editSuccessBanner = !!(
      request.yar.flash(ORS_EDIT_SUCCESS_FLASH) ?? []
    ).length

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.overseasSites?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const queryNote = resolveRegulatorQueryNote(application, { readOnly })

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        partitionSites(application.overseasSites?.sites),
        null,
        {
          successBanner,
          queryNote,
          interimSiteSuccessBanner,
          promoteSuccessBanner,
          editSuccessBanner,
          querySummary: queryNote
            ? buildRegulatorQuerySummary('overseasSites', t)
            : null,
          regulatorQueryFields: queryNote
            ? [
                {
                  label: t('pages.taskList.tasks.overseasSites'),
                  href: '#accredited-sites'
                }
              ]
            : null,
          readOnly,
          isQueriedApplication: application.applicationStatus === 'Queried'
        }
      )
    )
  }
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
      `Error fetching application ${applicationId}: ${err.message}`
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
// patchOverseasSites path as removeInterimSite below, just with an edited interimSite object
// instead of null, keyed on the unchanged interimSite siteId (per backend RA-486 confirmation).
function buildInterimSiteSessionSeed(interimSite) {
  return {
    country: interimSite.country ?? '',
    siteName: interimSite.siteName ?? '',
    addressLine1: interimSite.addressLine1 ?? '',
    addressLine2: interimSite.addressLine2 ?? '',
    townOrCity: interimSite.townOrCity ?? '',
    stateOrRegion: interimSite.stateOrRegion ?? '',
    postcode: interimSite.postcode ?? '',
    siteContactName: interimSite.contactName ?? '',
    siteContactEmail: interimSite.contactEmail ?? '',
    siteContactPhone: interimSite.contactPhone ?? '',
    recyclingOperationCodes: interimSite.operationCodes ?? []
  }
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

export const selectOverseasSitesPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction, siteId } = request.payload ?? {}

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      request.server.logger.error(
        `Error fetching application ${applicationId}: ${err.message}`
      )
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          partitionSites([]),
          t('pages.selectOverseasSites.loadError')
        )
      ).code(500)
    }

    const guardRedirect = guardSectionWrite({
      h,
      application,
      sectionStatus: application.overseasSites?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const rawSites = application.overseasSites?.sites ?? []

    const ctx = { h, t, request, logger: request.server.logger }

    if (
      submitAction === 'removeAccredited' ||
      submitAction === 'deleteNewSite'
    ) {
      return removeOrDeleteSite(
        ctx,
        organisationId,
        applicationId,
        rawSites,
        submitAction,
        siteId
      )
    }

    if (submitAction === 'removeInterimSite') {
      return removeInterimSite(
        ctx,
        organisationId,
        applicationId,
        rawSites,
        siteId
      )
    }

    if (submitAction === 'saveAndComeLater') {
      return saveOverseasSitesForLater(
        ctx,
        organisationId,
        applicationId,
        rawSites
      )
    }

    if (submitAction === 'revertAccreditation') {
      return revertSiteAccreditation(
        ctx,
        organisationId,
        applicationId,
        rawSites,
        siteId
      )
    }

    const sections = partitionSites(rawSites)
    const accreditedCount =
      sections.accredited.length +
      sections.newSites.length +
      sections.registeredSitesAdded.length
    if (accreditedCount === 0) {
      return renderPage(
        h,
        buildViewData(
          t,
          applicationId,
          sections,
          t('pages.selectOverseasSites.validation.noSitesAccredited')
        )
      ).code(400)
    }

    return h.redirect(confirmOverseasSitesUrl(applicationId))
  }
}
