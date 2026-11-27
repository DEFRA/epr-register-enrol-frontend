import Boom from '@hapi/boom'

import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  CHANGE_TYPES,
  ITEM_STATUSES
} from '../../common/constants/changeRequests.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import {
  PENCE_PER_POUND,
  buildInYearOrsPaymentDetails,
  buildPaymentReference,
  resolveNation,
  resolveRegulatorContact
} from '../../common/helpers/paymentDetails.js'
import {
  buildViewData as buildDeclarationViewData,
  validateDeclaration
} from '../submit-declaration/controller.js'
import { orsAddressLine } from '../../common/helpers/orsAddress.js'
import {
  accreditationChangesService,
  validationErrors
} from '../../common/helpers/accreditationChangesService.js'
import { uploadRejectionErrorFromQuery } from '../upload-bes-evidence/controller.js'
import {
  buildMissingFieldErrors,
  manageSitesText,
  buildSummaryRows,
  findRequestSite,
  findSite
} from './view-model.js'
import {
  addToAccreditationUrl,
  cancelUpdateUrl,
  declarationUrl,
  manageSitesUrl,
  paymentUrl,
  requestsUrl,
  submittedUrl,
  updateUrl
} from './urls.js'

const VIEWS = {
  summary: 'accreditation/manage-overseas-sites/add-to-accreditation',
  requests: 'accreditation/manage-overseas-sites/requests',
  declaration: 'accreditation/submit-declaration/index',
  payment: 'accreditation/view-payment-details/index'
}

// 404 (no such application, site or draft) and 409 (not a granted exporter
// accreditation, a site that cannot be added, or a draft already sent or
// submitted) mean the same thing to these pages: there is nothing to show or
// do.
export const NOTHING_TO_DO = new Set([
  statusCodes.notFound,
  statusCodes.conflict
])

export function organisationIdFrom(request) {
  return request.yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
}

/**
 * The backend's view of the granted accreditation. 404 (no such
 * application) and 409 (not Approved) both mean this journey does not exist
 * for the application, as does a view with no sites: RA-697's view of a
 * granted reprocessor, which has no overseas sites to add.
 */
export async function loadView(request) {
  let view
  try {
    view = await accreditationChangesService.getView(
      organisationIdFrom(request),
      request.params.applicationId
    )
  } catch (err) {
    if (NOTHING_TO_DO.has(err.status)) {
      throw Boom.notFound()
    }
    throw err
  }
  if (!view.sites?.length) {
    throw Boom.notFound()
  }
  return view
}

/**
 * Back to RA-425's Manage overseas reprocessing sites page, for the
 * accreditation in `view` (loaded when the caller has not already).
 */
export async function redirectToManageSites(request, h, view) {
  const { currentLocale } = getLocaleAndTranslator(request)
  return h.redirect(
    manageSitesUrl(view ?? (await loadView(request)), currentLocale)
  )
}

/**
 * The registered site being added, with its draft entry. Null (the caller
 * redirects to Manage ORS) when the site is not in the in-progress request -
 * including when it is in a submitted one, which the operator may not
 * change again until the regulator decides (AC09).
 */
export function resolveDraftSite(view, siteId) {
  const entry = findSite(view, siteId)
  const requestSite = findRequestSite(view, siteId)
  if (
    !entry ||
    !requestSite ||
    entry.pendingRequestStatus === ITEM_STATUSES.submitted
  ) {
    return null
  }
  return { entry, requestSite }
}

// AC03/AC04: the charge as the backend calculated it (pence -> pounds).
function chargeFor(charge) {
  return {
    count: charge.chargeableSites,
    perSite: charge.chargePerSitePence / PENCE_PER_POUND,
    total: charge.totalPence / PENCE_PER_POUND
  }
}

// "Add to accreditation" (f03): a crumb-protected POST, because it creates
// or changes the draft request.
export const addSiteToRequestController = {
  async handler(request, h) {
    const { applicationId, siteId } = request.params
    try {
      await accreditationChangesService.addSite(
        organisationIdFrom(request),
        applicationId,
        siteId
      )
    } catch (err) {
      // 404 unknown site, 409 already accredited or in a submitted request
      // (AC09), or the draft's sites are fixed by an earlier send to the
      // regulator: nothing to add, so back to the list that offered it.
      if (NOTHING_TO_DO.has(err.status)) {
        return redirectToManageSites(request, h)
      }
      throw err
    }
    return h.redirect(addToAccreditationUrl(applicationId, siteId))
  }
}

function renderSummary(
  h,
  { t, currentLocale },
  { view, applicationId, entry, requestSite, errors }
) {
  const siteName = entry.site.siteName
  const rows = buildSummaryRows({ t, applicationId, entry, requestSite })
  const errorByRow = Object.fromEntries(
    (errors ?? []).map((error) => [error.row, error.text])
  )
  const heading = `${manageSitesText(t, 'summary.headingPrefix')} ${siteName} (${entry.orsId})`
  return h.view(VIEWS.summary, {
    pageTitle: heading,
    heading,
    backLink: manageSitesUrl(view, currentLocale),
    cancelUrl: `${addToAccreditationUrl(applicationId, entry.siteId)}/cancel`,
    rows: rows.map((row) => ({ ...row, error: errorByRow[row.id] ?? null })),
    errors: errors ?? []
  })
}

// 3bb.49: the requests page links a site the backend refused at submit for
// its BES files here with the refusal as the reason, shown on the BES row
// with the upload page's message.
export const addToAccreditationGetController = {
  async handler(request, h) {
    const locale = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const view = await loadView(request)
    const draft = resolveDraftSite(view, siteId)
    if (!draft) {
      return redirectToManageSites(request, h, view)
    }
    const besError = uploadRejectionErrorFromQuery(request, locale.t)
    return renderSummary(h, locale, {
      view,
      applicationId,
      ...draft,
      errors: besError ? [{ row: 'bes-evidence', text: besError }] : []
    })
  }
}

// Continue (AC02): the backend says which fields are still missing; any
// left keeps the operator on the summary with each one identified.
export const addToAccreditationPostController = {
  async handler(request, h) {
    const locale = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const view = await loadView(request)
    const draft = resolveDraftSite(view, siteId)
    if (!draft) {
      return redirectToManageSites(request, h, view)
    }
    const errors = buildMissingFieldErrors(locale.t, draft.requestSite)
    if (errors.length > 0) {
      return renderSummary(h, locale, {
        view,
        applicationId,
        ...draft,
        errors
      }).code(statusCodes.badRequest)
    }
    return h.redirect(requestsUrl(applicationId))
  }
}

// Removes one uploaded BES evidence file from the draft site, as the
// reaccreditation journey's evidence page does. A file that has already
// gone needs nothing more; any other failure stays on the summary with the
// same error that page shows.
export const removeBesEvidenceFileController = {
  async handler(request, h) {
    const locale = getLocaleAndTranslator(request)
    const { applicationId, siteId, fileId } = request.params
    const view = await loadView(request)
    const draft = resolveDraftSite(view, siteId)
    if (!draft) {
      return redirectToManageSites(request, h, view)
    }
    try {
      await accreditationChangesService.deleteBesEvidenceFile(
        organisationIdFrom(request),
        applicationId,
        draft.entry.siteId,
        fileId
      )
    } catch (err) {
      if (err.status !== statusCodes.notFound) {
        logStructuredError(
          request.logger,
          err,
          { applicationId, siteId, fileId },
          'Error deleting in-year BES evidence file'
        )
        const errors = [
          {
            row: 'bes-evidence',
            text: locale.t('pages.cyaEvidenceForSite.validation.deleteError')
          }
        ]
        return renderSummary(h, locale, {
          view,
          applicationId,
          ...draft,
          errors
        }).code(statusCodes.internalServerError)
      }
    }
    return h.redirect(addToAccreditationUrl(applicationId, siteId))
  }
}

// Cancel on the summary: the operator no longer wants this site added, so
// it leaves the draft (the backend deletes the draft with its last site).
export const cancelAddToAccreditationController = {
  async handler(request, h) {
    const { applicationId, siteId } = request.params
    try {
      await accreditationChangesService.removeSite(
        organisationIdFrom(request),
        applicationId,
        siteId
      )
    } catch (err) {
      // 404 already gone. 409: the request was sent to the regulator once,
      // so its sites are fixed until a resubmit succeeds.
      if (!NOTHING_TO_DO.has(err.status)) {
        throw err
      }
    }
    return redirectToManageSites(request, h)
  }
}

function itemUrl(applicationId, site) {
  return site.changeType === CHANGE_TYPES.updateOverseasSite
    ? updateUrl(applicationId, site.siteId)
    : addToAccreditationUrl(applicationId, site.siteId)
}

function renderRequests(
  h,
  { t, currentLocale },
  { applicationId, view, errors }
) {
  const sites = view.activeRequest?.sites ?? []
  const manageUrl = manageSitesUrl(view, currentLocale)
  return h.view(VIEWS.requests, {
    pageTitle: manageSitesText(t, 'requests.title'),
    heading: manageSitesText(t, 'requests.title'),
    backLink: manageUrl,
    cancelUrl: manageUrl,
    // AC10: "Add another request" goes to the registered ORS list.
    addAnotherUrl: manageSitesUrl(view, currentLocale, { registered: true }),
    requests: sites.map((site) => {
      const entry = findSite(view, site.siteId)
      const isUpdate = site.changeType === CHANGE_TYPES.updateOverseasSite
      return {
        siteId: site.siteId,
        orsId: site.orsId,
        siteName: site.siteName,
        address: orsAddressLine(entry.site),
        typeKey: isUpdate
          ? 'pages.manageChangeRequests.types.updateOverseasSite'
          : 'pages.manageOverseasSites.requests.newOrs',
        viewUrl: itemUrl(applicationId, site),
        removeUrl: isUpdate ? cancelUpdateUrl(applicationId, site.siteId) : null
      }
    }),
    // RA-682 AC05: only adding an ORS is charged.
    charge: isCharged(view.activeRequest)
      ? chargeFor(view.activeRequest.charge)
      : null,
    errors: errors ?? []
  })
}

// 3bb.49: the backend's submit refusals for a site's BES files, by its
// ValidationProblem key suffix, as the requests page's query parameter (also
// the summary page's reason). The message is the BES upload page's own, as in
// the accreditation application journey (user, 2026-11-18).
const BES_SUBMIT_REFUSALS = [
  {
    key: 'besEvidenceMaxFiles',
    reason: 'maxFiles',
    text: 'pages.uploadBesEvidence.validation.maxFiles'
  },
  {
    key: 'besEvidenceDuplicateFilename',
    reason: 'duplicateFilename',
    text: 'pages.uploadBesEvidence.validation.duplicateFilename'
  }
]

const SITE_ERROR_KEY = /^sites\[(\d+)\]\.(\w+)$/

function besRefusalQuery(err) {
  const siteIds = Object.keys(validationErrors(err))
    .map((key) => SITE_ERROR_KEY.exec(key))
    .filter(Boolean)
  const params = new URLSearchParams()
  for (const refusal of BES_SUBMIT_REFUSALS) {
    const ids = siteIds
      .filter(([, , suffix]) => suffix === refusal.key)
      .map(([, id]) => id)
    if (ids.length > 0) {
      params.set(refusal.reason, ids.join(','))
    }
  }
  return params.toString()
}

function besRefusalErrors(t, applicationId, view, query) {
  const sites = view.activeRequest?.sites ?? []
  return BES_SUBMIT_REFUSALS.flatMap((refusal) => {
    const ids = new Set(String(query?.[refusal.reason] ?? '').split(','))
    return sites
      .filter((site) => ids.has(String(site.siteId)))
      .map((site) => ({
        href: `${addToAccreditationUrl(applicationId, site.siteId)}?reason=${refusal.reason}`,
        // A site refused for both reasons has two entries, so the reason keeps each id unique.
        testId: `error-request-${site.orsId}-${refusal.reason}`,
        text: t(refusal.text)
      }))
  })
}

export const requestsGetController = {
  async handler(request, h) {
    const locale = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const view = await loadView(request)
    return renderRequests(h, locale, {
      applicationId,
      view,
      errors: besRefusalErrors(locale.t, applicationId, view, request.query)
    })
  }
}

export const requestsPostController = {
  async handler(request, h) {
    const locale = getLocaleAndTranslator(request)
    const { t } = locale
    const { applicationId } = request.params
    const view = await loadView(request)
    const sites = view.activeRequest?.sites ?? []
    if (sites.length === 0) {
      return redirectToManageSites(request, h, view)
    }
    const incomplete = sites.filter((site) => site.isComplete === false)
    if (incomplete.length > 0) {
      const errors = incomplete.map((site) => ({
        href: itemUrl(applicationId, site),
        testId: `error-request-${site.orsId}`,
        text: manageSitesText(t, 'requests.incomplete', {
          site: site.siteName,
          orsId: site.orsId
        })
      }))
      return renderRequests(h, locale, { applicationId, view, errors }).code(
        statusCodes.badRequest
      )
    }
    return h.redirect(declarationUrl(applicationId))
  }
}

function declarationViewData(t, applicationId, fullName, jobTitle) {
  return {
    ...buildDeclarationViewData(t, applicationId, fullName, jobTitle),
    backLink: requestsUrl(applicationId)
  }
}

// AC05: the existing declaration page, reached only with a complete draft.
export const declarationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const view = await loadView(request)
    if (!view.activeRequest?.isComplete) {
      return h.redirect(requestsUrl(applicationId))
    }
    return h.view(
      VIEWS.declaration,
      declarationViewData(t, applicationId, '', '')
    )
  }
}

// RA-503: the bank payment reference the payment page shows. Sent with the
// submission, as the application declaration sends it, so the regulator sees
// the reference the operator was told to quote.
function paymentReferenceFor(application) {
  return buildPaymentReference(
    resolveNation(application),
    application.organisationNumber,
    application.isExporter
  )
}

function isCharged(changeRequest) {
  return (changeRequest?.charge?.chargeableSites ?? 0) > 0
}

/**
 * The submitted request a page after the declaration shows: the one just
 * submitted when the redirect names it, otherwise the most recently created
 * one that `matches` (the page opened directly, or with Back). Null when there
 * is none.
 */
export function submittedRequest(view, requestId, matches) {
  return (
    view.requests?.find(
      (changeRequest) =>
        changeRequest.status === ITEM_STATUSES.submitted &&
        (!requestId || changeRequest.requestId === requestId) &&
        matches(changeRequest)
    ) ?? null
  )
}

export const declarationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const payload = request.payload ?? {}
    if (payload.submitAction === 'saveAndComeLater') {
      return redirectToManageSites(request, h)
    }
    const fullName = (payload.fullName ?? '').trim()
    const jobTitle = (payload.jobTitle ?? '').trim()
    const errors = validateDeclaration(fullName, jobTitle, t)
    if (Object.keys(errors).length > 0) {
      return h
        .view(VIEWS.declaration, {
          ...declarationViewData(t, applicationId, fullName, jobTitle),
          errors
        })
        .code(statusCodes.badRequest)
    }
    let submitted
    try {
      const organisationId = organisationIdFrom(request)
      const application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
      submitted = await accreditationChangesService.submit(
        organisationId,
        applicationId,
        {
          fullName,
          jobTitle,
          email: getUser(request)?.email ?? null,
          paymentReference: paymentReferenceFor(application)
        }
      )
    } catch (err) {
      // 404: no draft to submit. 409: a concurrent submit (another tab) won,
      // so this one has nothing left to submit either.
      if (NOTHING_TO_DO.has(err.status)) {
        return redirectToManageSites(request, h)
      }
      if (err.status === statusCodes.unprocessableEntity) {
        const query = besRefusalQuery(err)
        return h.redirect(
          query
            ? `${requestsUrl(applicationId)}?${query}`
            : requestsUrl(applicationId)
        )
      }
      logStructuredError(
        request.logger,
        err,
        { applicationId },
        'Error submitting in-year accreditation change request'
      )
      return h
        .view(VIEWS.declaration, {
          ...declarationViewData(t, applicationId, fullName, jobTitle),
          error: t('pages.submitDeclaration.validation.submitError')
        })
        .code(statusCodes.internalServerError)
    }
    // RA-682 AC05: a request that only changes ORS details has nothing to pay.
    const next = isCharged(submitted) ? paymentUrl : submittedUrl
    return h.redirect(next(applicationId, submitted?.requestId))
  }
}

// f07: the existing bank-transfer payment page, charged per ORS only
// (AC03/AC04) for the request just submitted.
export const paymentGetController = {
  async handler(request, h) {
    const { t, currentLocale } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = organisationIdFrom(request)
    const view = await loadView(request)
    const submitted = submittedRequest(view, request.query?.request, isCharged)
    if (!submitted) {
      return redirectToManageSites(request, h, view)
    }
    const application = await accreditationApiService.getApplication(
      organisationId,
      applicationId
    )
    const nation = resolveNation(application)
    const paymentDetails = buildInYearOrsPaymentDetails(
      application,
      t,
      nation,
      submitted.charge
    )
    return h.view(VIEWS.payment, {
      pageTitle: t('pages.viewPaymentDetails.title'),
      backLink: manageSitesUrl(view, currentLocale),
      backLinkText: manageSitesText(t, 'payment.backLink'),
      materialDisplay: materialDisplayName(application, t),
      submitterName: submitted.submittedBy.fullName,
      submitterEmail: submitted.submittedBy.email ?? '',
      paymentReference: paymentReferenceFor(application),
      regulatorName: paymentDetails.companyName ?? paymentDetails.accountName,
      regulatorContact: resolveRegulatorContact(nation),
      paymentDetails
    })
  }
}
