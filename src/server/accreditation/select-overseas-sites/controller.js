import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  resolveRegulatorQueryNote
} from '../../common/helpers/regulatorQuery.js'
import { resolveQueriedSectionAccess } from '../../common/helpers/queriedSectionAccess.js'
import {
  resetAddOrsSession,
  setAddOrsSession
} from '../../common/helpers/addOverseasSiteSession.js'

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

function withEditUrl(applicationId, sites) {
  return sites.map((site) => ({
    ...site,
    editUrl: editUrl(applicationId, site.siteId)
  }))
}

function buildViewData(t, applicationId, sections, error, banners = {}) {
  return {
    pageTitle: t('pages.selectOverseasSites.title'),
    heading: t('pages.selectOverseasSites.heading'),
    accreditedSites: withEditUrl(applicationId, sections.accredited),
    registeredSites: sections.registered.map((site) => ({
      ...site,
      promoteUrl: promoteUrl(applicationId, site.siteId)
    })),
    newSites: withEditUrl(applicationId, sections.newSites),
    registeredSitesAddedSites: withEditUrl(
      applicationId,
      sections.registeredSitesAdded
    ),
    backLink: banners.readOnly
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    addOrsUrl: addOrsUrl(applicationId),
    successBanner: banners.successBanner ?? false,
    error,
    queryNote: banners.queryNote ?? null,
    interimSiteSuccessBanner: banners.interimSiteSuccessBanner ?? false,
    promoteSuccessBanner: banners.promoteSuccessBanner ?? false,
    editSuccessBanner: banners.editSuccessBanner ?? false,
    querySummary: banners.querySummary ?? null,
    regulatorQueryFields: banners.regulatorQueryFields ?? null,
    readOnly: banners.readOnly ?? false
  }
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
          readOnly
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

    if (isOverseasSitesSectionWriteBlocked(application)) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const rawSites = application.overseasSites?.sites ?? []

    if (
      submitAction === 'removeAccredited' ||
      submitAction === 'deleteNewSite'
    ) {
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
        request.server.logger.error(
          `Error updating overseas site ${siteId} on ${applicationId}: ${err.message}`
        )
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
      return h.redirect(selectOverseasSitesUrl(applicationId))
    }

    if (submitAction === 'revertAccreditation') {
      try {
        await accreditationApiService.revertOverseasSite(
          organisationId,
          applicationId,
          Number.parseInt(siteId, 10)
        )
      } catch (err) {
        request.server.logger.error(
          `Error reverting overseas site ${siteId} on ${applicationId}: ${err.message}`
        )
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
      return h.redirect(selectOverseasSitesUrl(applicationId))
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
