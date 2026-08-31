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
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'

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
    logControllerError(
      logger,
      err,
      { siteId, applicationId },
      `Error updating overseas site ${siteId} for application ${applicationId}`
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
    logControllerError(
      logger,
      err,
      { siteId, applicationId },
      `Error removing interim site from overseas site ${siteId} for application ${applicationId}`
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
    logControllerError(
      logger,
      err,
      { applicationId },
      `Error saving overseas sites for application ${applicationId}`
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
    logControllerError(
      logger,
      err,
      { siteId, applicationId },
      `Error reverting overseas site ${siteId} for application ${applicationId}`
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
      logControllerError(
        request.server.logger,
        err,
        { applicationId },
        `Error fetching application ${applicationId}`
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
      logControllerError(
        request.server.logger,
        err,
        { applicationId },
        `Error fetching application ${applicationId}`
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
