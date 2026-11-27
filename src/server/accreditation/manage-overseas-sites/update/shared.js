import { getLocaleAndTranslator } from '../../../common/helpers/get-locale-translator.js'
import { statusCodes } from '../../../common/constants/status-codes.js'
import {
  CHANGE_TYPES,
  MISSING_CHANGES
} from '../../../common/constants/changeRequests.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'
import {
  accreditationChangesService,
  conflictMessage,
  validationErrors
} from '../../../common/helpers/accreditationChangesService.js'
import {
  loadView,
  organisationIdFrom,
  redirectToManageSites
} from '../controller.js'
import { refusedFields } from '../steps-controller.js'
import {
  manageSitesUrl,
  newInterimSiteUrl,
  requestsUrl,
  updateUrl
} from '../urls.js'
import {
  buildDetailRows,
  buildInterimRows,
  resolveUpdate,
  updateText
} from './view-model.js'

// RA-682: what the ORS update journey's controllers share.

export const VIEWS = {
  details: 'accreditation/manage-overseas-sites/update/details',
  step: 'accreditation/manage-overseas-sites/update/step',
  interim: 'accreditation/manage-overseas-sites/update/interim',
  submitted: 'accreditation/manage-overseas-sites/update/submitted'
}

/**
 * The accredited ORS for the route, or a redirect to Manage ORS when it isn't
 * one. With `editable`, an ORS held by a submitted request (AC03) goes back to
 * its details page, which shows it read only.
 */
export async function loadUpdate(request, h, { editable = false } = {}) {
  const { applicationId, siteId } = request.params
  const view = await loadView(request)
  const update = resolveUpdate(view, siteId)
  if (!update) {
    return { redirect: await redirectToManageSites(request, h, view) }
  }
  if (editable && update.pending) {
    return { redirect: h.redirect(updateUrl(applicationId, siteId)) }
  }
  return { view, update }
}

export function handler(options, run) {
  return {
    async handler(request, h) {
      const loaded = await loadUpdate(request, h, options)
      if (loaded.redirect) {
        return loaded.redirect
      }
      return run(request, h, getLocaleAndTranslator(request), loaded)
    }
  }
}

// After a failed first save the update item holds nothing, so it comes back
// out rather than show the ORS as In progress with no change. AddSite returns
// an item another tab started too, so it is taken out only while it is still
// empty.
export async function takeOutEmptyItem(
  request,
  organisationId,
  applicationId,
  siteId
) {
  try {
    const item = resolveUpdate(await loadView(request), siteId)?.item
    if (!item?.missingFields?.includes(MISSING_CHANGES)) {
      return
    }
    await accreditationChangesService.removeSite(
      organisationId,
      applicationId,
      siteId
    )
  } catch (err) {
    logStructuredError(
      request.logger,
      err,
      { applicationId, siteId },
      'Could not take an empty ORS update back out of the draft'
    )
  }
}

/**
 * Starts the ORS's update item if the draft doesn't hold it yet, then runs
 * `call`. Returns null when it saved, the backend's field errors on a 400, its
 * message on a 409 (a concurrent edit, or a change already sent), or a
 * redirect when the ORS has gone.
 */
export async function saveChange(request, h, update, call) {
  const { applicationId, siteId } = request.params
  const organisationId = organisationIdFrom(request)
  let started = false
  try {
    if (!update.item) {
      await accreditationChangesService.addSite(
        organisationId,
        applicationId,
        siteId,
        CHANGE_TYPES.updateOverseasSite
      )
      started = true
    }
    await call(organisationId, applicationId, siteId)
    return null
  } catch (err) {
    if (started) {
      await takeOutEmptyItem(request, organisationId, applicationId, siteId)
    }
    if (err.status === statusCodes.badRequest) {
      return { errors: validationErrors(err) }
    }
    if (err.status === statusCodes.conflict) {
      return { message: conflictMessage(err) }
    }
    if (err.status === statusCodes.notFound) {
      return { redirect: h.redirect(updateUrl(applicationId, siteId)) }
    }
    throw err
  }
}

/**
 * A refused save, for its form: a 400's messages against the fields it names
 * (or the first field), a 409's message for the whole page, as it is about
 * the request rather than any one field.
 */
export function refused(t, result, names) {
  return result.errors
    ? { errors: refusedFields(t, result.errors, names) }
    : {
        errors: {},
        pageError: result.message ?? t('pages.manageOverseasSites.saveRefused')
      }
}

export function refusedStatus(result) {
  return result.errors ? statusCodes.badRequest : statusCodes.conflict
}

export function errorList(errors, pageError) {
  return [
    ...(pageError ? [{ href: null, text: pageError }] : []),
    ...Object.entries(errors).map(([name, text]) => ({
      href: `#${name}`,
      text
    }))
  ]
}

// --- Site details (Figma screens 3 and 5) -----------------------------------

export function statusOf({ pending, item }) {
  if (pending) {
    return 'pending'
  }
  return item ? 'inProgress' : 'approved'
}

export function detailsView(
  h,
  request,
  { t, currentLocale },
  loaded,
  error = null
) {
  const { applicationId } = request.params
  const { view, update } = loaded
  const { entry, item, pending } = update
  const updated = request.query?.updated
  const name = `${entry.site.siteName} (${entry.orsId})`
  return h.view(VIEWS.details, {
    pageTitle: name,
    heading: name,
    backLink: manageSitesUrl(view, currentLocale),
    manageSitesUrl: manageSitesUrl(view, currentLocale),
    status: statusOf(update),
    validFrom: entry.site.validFrom ?? null,
    successBanner:
      updated && !error ? updateText(t, `updated.${updated}`) : null,
    error,
    rows: buildDetailRows({ t, applicationId, update }),
    interimSites: buildInterimRows({ applicationId, update }),
    addInterimSiteUrl: pending
      ? null
      : newInterimSiteUrl(applicationId, entry.siteId),
    continueUrl: item ? requestsUrl(applicationId) : null,
    pending
  })
}
