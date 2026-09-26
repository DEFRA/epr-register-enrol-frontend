import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  buildRegulatorQuerySummary,
  isRegulatorQueryBannerVisible
} from '../../common/helpers/regulatorQuery.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import {
  activeInterimSites,
  withdrawnInterimSites
} from '../../common/helpers/interimSites.js'
import {
  removeInterimSite,
  restoreInterimSite,
  INTERIM_SITE_WITHDRAWN_FLASH
} from './interim-site-actions.js'

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
// RA-603 C4: unlike the other four this flash carries DATA, not just a boolean.
// Undoing a withdrawal needs to know which interim site was withdrawn, and
// naming it in the banner is what makes the offer meaningful rather than a bare
// "undo something".

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

// RA-603: keyed on the interim site's OWN id, not its parent ORS's. Interim ids
// are unique application-wide (the backend allocates ORS and interim ids from
// one sequence), so an interim site can be addressed on its own — which is the
// only way this works once an ORS can hold more than one.
function interimSiteEditUrl(applicationId, interimSiteId) {
  return `/accreditation/select-overseas-sites/${applicationId}/interim-site/edit/${interimSiteId}`
}

// Entry point for "Add another interim site". Takes the PARENT ORS id, since
// that is what the new interim site will be attached to.
function addInterimSiteUrl(applicationId, siteId) {
  return `/accreditation/select-overseas-sites/${applicationId}/interim-site/add/${siteId}`
}

// Flattened one-line address for the accordion's detail rows. Built here rather
// than in the template so the "drop the empty parts" rule is unit-testable and
// lives beside the other view-model shaping, matching how the add-interim-site
// check-your-answers page already composes its location row.
function interimSiteAddressLine(interimSite) {
  return [
    interimSite.addressLine1,
    interimSite.addressLine2,
    interimSite.townOrCity,
    interimSite.stateOrRegion,
    interimSite.postcode
  ]
    .filter(Boolean)
    .join(', ')
}

// Each interim site carries its own URLs rather than the view deriving them, so
// the routes stay defined in one place.
function decorateInterimSites(applicationId, interimSites) {
  return interimSites.map((interimSite) => ({
    ...interimSite,
    addressLine: interimSiteAddressLine(interimSite),
    editUrl: interimSiteEditUrl(applicationId, interimSite.siteId)
  }))
}

// RA-603 AC05: `interimSites` is what the operator has; `withdrawnInterimSites`
// is what they have taken off and can put back. Withdrawn sites are kept out of
// the main list entirely rather than greyed out in it — AC05 keeps them for
// reporting, not for display — which is also why the "Show interim sites (n)"
// count is taken from the active list alone.
function decorateSite(applicationId, site) {
  return {
    ...site,
    interimSites: decorateInterimSites(applicationId, activeInterimSites(site)),
    withdrawnInterimSites: decorateInterimSites(
      applicationId,
      withdrawnInterimSites(site)
    ),
    addInterimSiteUrl: addInterimSiteUrl(applicationId, site.siteId)
  }
}

function withEditUrl(applicationId, sites) {
  return sites.map((site) => ({
    ...decorateSite(applicationId, site),
    editUrl: editUrl(applicationId, site.siteId)
  }))
}

// Extracted from buildViewData (SonarCloud cognitive complexity): the ?? defaulting for
// each banner/flash flag was pushing buildViewData itself over the complexity threshold.
// Extracted from selectOverseasSitesGetController's handler (SonarCloud function-length):
// reads the four independent post-redirect flash flags this page can show.
function resolveFlashBanners(yar) {
  return {
    successBanner: !!(yar.flash(ORS_SUCCESS_FLASH) ?? []).length,
    interimSiteSuccessBanner: !!(yar.flash(INTERIM_SITE_SUCCESS_FLASH) ?? [])
      .length,
    promoteSuccessBanner: !!(yar.flash(ORS_PROMOTE_SUCCESS_FLASH) ?? []).length,
    editSuccessBanner: !!(yar.flash(ORS_EDIT_SUCCESS_FLASH) ?? []).length,
    withdrawnInterimSite:
      (yar.flash(INTERIM_SITE_WITHDRAWN_FLASH) ?? [])[0] ?? null
  }
}

// Every banner the view expects, with the value it takes when the caller says
// nothing. Held as data rather than ten `??` expressions: the branch-per-field
// version read as ten decisions when it is really one rule applied ten times.
const BANNER_DEFAULTS = {
  successBanner: false,
  queried: false,
  interimSiteSuccessBanner: false,
  promoteSuccessBanner: false,
  editSuccessBanner: false,
  withdrawnInterimSite: null,
  querySummary: null,
  regulatorQueryFields: null,
  readOnly: false,
  isQueriedApplication: false
}

function resolveBannerDefaults(banners) {
  return Object.fromEntries(
    Object.entries(BANNER_DEFAULTS).map(([key, fallback]) => [
      key,
      banners[key] ?? fallback
    ])
  )
}

function buildViewData(t, applicationId, sections, error, banners = {}) {
  return {
    pageTitle: t('pages.selectOverseasSites.title'),
    heading: t('pages.selectOverseasSites.heading'),
    accreditedSites: withEditUrl(applicationId, sections.accredited),
    registeredSites: sections.registered.map((site) => ({
      ...decorateSite(applicationId, site),
      promoteUrl: promoteUrl(applicationId, site.siteId)
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
    logStructuredError(
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
    logStructuredError(
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
    logStructuredError(
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

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            partitionSites([]),
            t('pages.selectOverseasSites.loadError')
          )
        ).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const {
      successBanner,
      interimSiteSuccessBanner,
      promoteSuccessBanner,
      editSuccessBanner,
      withdrawnInterimSite
    } = resolveFlashBanners(request.yar)

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.overseasSites?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const queried = isRegulatorQueryBannerVisible(application, { readOnly })

    return renderPage(
      h,
      buildViewData(
        t,
        applicationId,
        partitionSites(application.overseasSites?.sites),
        null,
        {
          successBanner,
          queried,
          interimSiteSuccessBanner,
          promoteSuccessBanner,
          editSuccessBanner,
          withdrawnInterimSite,
          querySummary: queried
            ? buildRegulatorQuerySummary('overseasSites', t)
            : null,
          regulatorQueryFields: queried
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

// Extracted from selectOverseasSitesPostController's handler (SonarCloud cyclomatic
// complexity): collapses the five submitAction branches into a single lookup instead of a
// chain of ifs. Each entry has the same (ctx, organisationId, applicationId, rawSites,
// siteId) shape as its target function, even where siteId is unused, so they're
// interchangeable through this table.
// RA-603: `ids` carries both the ORS id and, for the interim actions, the
// interim site's own id. They are different things - an interim site is
// addressed by its own application-wide unique id, not by its parent's - so
// passing one `siteId` to everything stopped being enough.
const OVERSEAS_SITES_ACTION_HANDLERS = {
  removeAccredited: (ctx, organisationId, applicationId, rawSites, ids) =>
    removeOrDeleteSite(
      ctx,
      organisationId,
      applicationId,
      rawSites,
      'removeAccredited',
      ids.siteId
    ),
  deleteNewSite: (ctx, organisationId, applicationId, rawSites, ids) =>
    removeOrDeleteSite(
      ctx,
      organisationId,
      applicationId,
      rawSites,
      'deleteNewSite',
      ids.siteId
    ),
  removeInterimSite: (ctx, organisationId, applicationId, rawSites, ids) =>
    removeInterimSite(
      ctx,
      { selectOverseasSitesUrl, renderSaveError },
      organisationId,
      applicationId,
      rawSites,
      ids.interimSiteId
    ),
  restoreInterimSite: (ctx, organisationId, applicationId, rawSites, ids) =>
    restoreInterimSite(
      ctx,
      { selectOverseasSitesUrl, renderSaveError },
      organisationId,
      applicationId,
      rawSites,
      ids.interimSiteId
    ),
  saveAndComeLater: (ctx, organisationId, applicationId, rawSites) =>
    saveOverseasSitesForLater(ctx, organisationId, applicationId, rawSites),
  revertAccreditation: (ctx, organisationId, applicationId, rawSites, ids) =>
    revertSiteAccreditation(
      ctx,
      organisationId,
      applicationId,
      rawSites,
      ids.siteId
    )
}

export const selectOverseasSitesPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction, siteId, interimSiteId } = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderPage(
          h,
          buildViewData(
            t,
            applicationId,
            partitionSites([]),
            t('pages.selectOverseasSites.loadError')
          )
        ).code(500)
    })
    if (errorResponse) {
      return errorResponse
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

    const actionHandler = OVERSEAS_SITES_ACTION_HANDLERS[submitAction]
    if (actionHandler) {
      return actionHandler(ctx, organisationId, applicationId, rawSites, {
        siteId,
        interimSiteId
      })
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
