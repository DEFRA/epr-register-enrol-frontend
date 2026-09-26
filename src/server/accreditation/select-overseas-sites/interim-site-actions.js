import { findInterimSite } from '../../common/helpers/interimSites.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { statusCodes } from '../../common/constants/status-codes.js'

/**
 * RA-603: the per-interim-site write actions, withdraw and restore.
 *
 * Their own module because they are one cohesive concern and because
 * controller.js had reached the 500-line limit. They take the two
 * controller-owned helpers they need (`selectOverseasSitesUrl`,
 * `renderSaveError`) as an injected `deps` object rather than importing them,
 * so nothing here points back at the controller and there is no import cycle.
 */
export const INTERIM_SITE_WITHDRAWN_FLASH = 'interimSiteWithdrawn'

// RA-603: withdrawing and restoring an interim site differ only in which
// endpoint they call, what they log, and whether they leave a flash behind.
// Locating the interim site, tolerating it already being gone, translating a 409
// into a reload and falling back to the save-error page are identical in both,
// and keeping two copies was the easiest way for them to drift apart.
//
// Both go through a single-interim-site endpoint rather than the bulk
// patchOverseasSites this used to use. That was a read-modify-write over the
// whole site list, so a concurrent change to any other site was silently
// overwritten - the most likely way to break "withdrawing one must not affect
// the others". One request, one interim site, decided by the server.
async function runInterimSiteAction(
  ctx,
  deps,
  {
    organisationId,
    applicationId,
    rawSites,
    interimSiteId,
    act,
    describe,
    onSuccess
  }
) {
  const { h, t, logger, request } = ctx
  const { selectOverseasSitesUrl, renderSaveError } = deps
  const found = findInterimSite(rawSites, Number.parseInt(interimSiteId, 10))
  if (!found) {
    return h.redirect(selectOverseasSitesUrl(applicationId))
  }

  try {
    await act(
      organisationId,
      applicationId,
      found.site.siteId,
      found.interimSite.siteId
    )
  } catch (err) {
    logStructuredError(
      logger,
      err,
      { interimSiteId, applicationId },
      describe(found)
    )
    // RA-481: a 409 means the application locked between the guard check in the
    // handler and this write landing - send the operator back to the same page
    // so it re-fetches and renders the section read-only.
    if (err.status === statusCodes.conflict) {
      return h.redirect(request.path)
    }
    return renderSaveError(h, t, applicationId, rawSites)
  }

  onSuccess?.(request, found)
  return h.redirect(selectOverseasSitesUrl(applicationId))
}

// The withdrawal is soft - the backend stamps removedAt and keeps the record for
// reporting (AC05) - so this is reversible, and restoreInterimSite reverses it.
export function removeInterimSite(
  ctx,
  deps,
  organisationId,
  applicationId,
  rawSites,
  interimSiteId
) {
  return runInterimSiteAction(ctx, deps, {
    organisationId,
    applicationId,
    rawSites,
    interimSiteId,
    act: (...args) => accreditationApiService.withdrawInterimSite(...args),
    describe: (found) =>
      `Error removing interim site ${found.interimSite.siteId} from overseas site ${found.site.siteId} for application ${applicationId}`,
    // RA-603 C4: name the site so the banner can offer it back specifically, and
    // carry its id so the Undo needs no lookup. A withdrawal is reversible right
    // up until the operator navigates away; after that the withdrawn-sites
    // disclosure is the way back.
    onSuccess: (request, found) =>
      request.yar.flash(INTERIM_SITE_WITHDRAWN_FLASH, {
        interimSiteId: found.interimSite.siteId,
        siteName: found.interimSite.siteName
      })
  })
}

// RA-603 C4: puts a withdrawn interim site back. The backend clears removedAt
// and nothing else, so the site returns with the siteId, siteNumber and
// createdAt it always had - the same record resuming, not a replacement, which
// is the whole reason withdrawal was made soft in the first place.
export function restoreInterimSite(
  ctx,
  deps,
  organisationId,
  applicationId,
  rawSites,
  interimSiteId
) {
  return runInterimSiteAction(ctx, deps, {
    organisationId,
    applicationId,
    rawSites,
    interimSiteId,
    act: (...args) => accreditationApiService.restoreInterimSite(...args),
    describe: () =>
      `Error restoring interim site ${interimSiteId} for application ${applicationId}`
  })
}
