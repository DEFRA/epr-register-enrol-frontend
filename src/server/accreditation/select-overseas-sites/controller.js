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

function buildViewData(t, applicationId, sections, error, banners = {}) {
  return {
    pageTitle: t('pages.selectOverseasSites.title'),
    heading: t('pages.selectOverseasSites.heading'),
    accreditedSites: sections.accredited,
    registeredSites: sections.registered.map((site) => ({
      ...site,
      promoteUrl: promoteUrl(applicationId, site.siteId)
    })),
    newSites: sections.newSites,
    registeredSitesAddedSites: sections.registeredSitesAdded,
    backLink: banners.readOnly
      ? queryTaskListUrl(applicationId)
      : taskListUrl(applicationId),
    addOrsUrl: addOrsUrl(applicationId),
    successBanner: banners.successBanner ?? false,
    error,
    queryNote: banners.queryNote ?? null,
    interimSiteSuccessBanner: banners.interimSiteSuccessBanner ?? false,
    promoteSuccessBanner: banners.promoteSuccessBanner ?? false,
    querySummary: banners.querySummary ?? null,
    regulatorQueryFields: banners.regulatorQueryFields ?? null,
    readOnly: banners.readOnly ?? false
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
// complexity/line count under SonarCloud's per-function thresholds.

async function removeOrDeleteSite(
  h,
  t,
  logger,
  organisationId,
  applicationId,
  rawSites,
  submitAction,
  siteId
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
    logger.error(
      `Error updating overseas site ${siteId} on ${applicationId}: ${err.message}`
    )
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(selectOverseasSitesUrl(applicationId))
}

async function saveOverseasSitesForLater(
  h,
  t,
  logger,
  organisationId,
  applicationId,
  rawSites
) {
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
    return renderSaveError(h, t, applicationId, rawSites)
  }
  return h.redirect(taskListUrl(applicationId))
}

async function revertSiteAccreditation(
  h,
  t,
  logger,
  organisationId,
  applicationId,
  rawSites,
  siteId
) {
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

// Entry point for the Registered section's "Add To Accreditation" button — seeds the
// add-overseas-site wizard session from an existing registered site's known fields (mirrors
// the linkedSiteId precedent used to seed the add-interim-site wizard from check-your-answers)
// then hands off to the wizard's first step. check-your-answers reads promotingSiteId back off
// the session to call promoteOverseasSite instead of createOverseasSite on submit.
export const selectOverseasSitesPromoteEntryGetController = {
  async handler(request, h) {
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
      return h.redirect(selectOverseasSitesUrl(applicationId))
    }

    const siteIdInt = Number.parseInt(siteId, 10)
    const site = application.overseasSites?.sites?.find(
      (s) => s.siteId === siteIdInt
    )
    if (!site) {
      return h.redirect(selectOverseasSitesUrl(applicationId))
    }

    resetAddOrsSession(request)
    setAddOrsSession(request, {
      siteName: site.siteName ?? '',
      addressLine1: site.addressLine1 ?? '',
      addressLine2: site.addressLine2 ?? '',
      townOrCity: site.townOrCity ?? '',
      country: site.country ?? '',
      coordinates: site.coordinates ?? '',
      siteContactName: site.contactName ?? '',
      siteContactEmail: site.contactEmail ?? '',
      siteContactPhone: site.contactPhone ?? '',
      recyclingOperationCodes: site.operationCodes ?? [],
      baselAndOecdCodes: [site.code1, site.code2, site.code3].filter(Boolean),
      repatriatedLoads: site.repatriatedLoads ?? '',
      conditionsOfExport: site.conditionsOfExport ?? null,
      promotingSiteId: site.siteId
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

    if (
      application.applicationStatus === 'Queried' &&
      application.overseasSites?.sectionStatus !== 'Queried'
    ) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const rawSites = application.overseasSites?.sites ?? []

    if (
      submitAction === 'removeAccredited' ||
      submitAction === 'deleteNewSite'
    ) {
      return removeOrDeleteSite(
        h,
        t,
        request.server.logger,
        organisationId,
        applicationId,
        rawSites,
        submitAction,
        siteId
      )
    }

    if (submitAction === 'saveAndComeLater') {
      return saveOverseasSitesForLater(
        h,
        t,
        request.server.logger,
        organisationId,
        applicationId,
        rawSites
      )
    }

    if (submitAction === 'revertAccreditation') {
      return revertSiteAccreditation(
        h,
        t,
        request.server.logger,
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
