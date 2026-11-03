import Boom from '@hapi/boom'

import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { landingUrl } from '../../common/helpers/accreditationUrls.js'
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
import { accreditationChangesService } from './service.js'
import {
  SUBMITTED,
  buildManageViewModel,
  buildMissingFieldErrors,
  buildSummaryRows,
  findRequestSite,
  findSite,
  siteAddressLine
} from './view-model.js'
import {
  addToAccreditationUrl,
  declarationUrl,
  manageOverseasSitesUrl,
  paymentUrl,
  registeredSitesUrl,
  requestsUrl
} from './urls.js'

const VIEWS = {
  manage: 'accreditation/manage-overseas-sites/index',
  summary: 'accreditation/manage-overseas-sites/add-to-accreditation',
  requests: 'accreditation/manage-overseas-sites/requests',
  declaration: 'accreditation/submit-declaration/index',
  payment: 'accreditation/view-payment-details/index'
}

const t2 = (t, key) => t(`pages.manageOverseasSites.${key}`)

// 404 (no such application or site) and 409 (not a granted exporter
// accreditation, or a site that cannot be added) mean the same thing to
// these pages: there is nothing to show or do.
const NOTHING_TO_DO = new Set([statusCodes.notFound, statusCodes.conflict])

export function organisationIdFrom(request) {
  return request.yar.get(ACCREDITATION_SESSION_KEYS.organisationId)
}

/**
 * The backend's view of the granted accreditation. 404 (no such
 * application) and 409 (not Approved, or not an exporter) both mean this
 * journey does not exist for the application.
 */
export async function loadView(request) {
  try {
    return await accreditationChangesService.getView(
      organisationIdFrom(request),
      request.params.applicationId
    )
  } catch (err) {
    if (NOTHING_TO_DO.has(err.status)) {
      throw Boom.notFound()
    }
    throw err
  }
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
  if (!entry || !requestSite || entry.pendingRequestStatus === SUBMITTED) {
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

export const manageOverseasSitesController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const view = await loadView(request)
    const { applicationId } = request.params
    return h.view(VIEWS.manage, {
      pageTitle: t2(t, 'title'),
      heading: t2(t, 'title'),
      backLink: landingUrl({ ...view, year: view.year }),
      year: view.year,
      requestsUrl: requestsUrl(applicationId),
      ...buildManageViewModel(view, applicationId)
    })
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
        Number.parseInt(siteId, 10)
      )
    } catch (err) {
      // 404 unknown site, 409 already accredited or in a submitted request
      // (AC09): nothing to add, so back to the list that offered it.
      if (NOTHING_TO_DO.has(err.status)) {
        return h.redirect(manageOverseasSitesUrl(applicationId))
      }
      throw err
    }
    return h.redirect(addToAccreditationUrl(applicationId, siteId))
  }
}

function renderSummary(h, t, { applicationId, entry, requestSite, errors }) {
  const siteName = entry.site.siteName
  const rows = buildSummaryRows({ t, applicationId, entry, requestSite })
  const errorByRow = Object.fromEntries(
    (errors ?? []).map((error) => [error.row, error.text])
  )
  const heading = `${t2(t, 'summary.headingPrefix')} ${siteName} (${entry.orsId})`
  return h.view(VIEWS.summary, {
    pageTitle: heading,
    heading,
    backLink: manageOverseasSitesUrl(applicationId),
    cancelUrl: `${addToAccreditationUrl(applicationId, entry.siteId)}/cancel`,
    rows: rows.map((row) => ({ ...row, error: errorByRow[row.id] ?? null })),
    errors: errors ?? []
  })
}

export const addToAccreditationGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const draft = resolveDraftSite(await loadView(request), siteId)
    if (!draft) {
      return h.redirect(manageOverseasSitesUrl(applicationId))
    }
    return renderSummary(h, t, { applicationId, ...draft })
  }
}

// Continue (AC02): the backend says which fields are still missing; any
// left keeps the operator on the summary with each one identified.
export const addToAccreditationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId, siteId } = request.params
    const draft = resolveDraftSite(await loadView(request), siteId)
    if (!draft) {
      return h.redirect(manageOverseasSitesUrl(applicationId))
    }
    const errors = buildMissingFieldErrors(t, draft.requestSite)
    if (errors.length > 0) {
      return renderSummary(h, t, { applicationId, ...draft, errors }).code(
        statusCodes.badRequest
      )
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
    const { t } = getLocaleAndTranslator(request)
    const { applicationId, siteId, fileId } = request.params
    const draft = resolveDraftSite(await loadView(request), siteId)
    if (!draft) {
      return h.redirect(manageOverseasSitesUrl(applicationId))
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
        request.logger.error(
          { err, applicationId, siteId, fileId },
          'Error deleting in-year BES evidence file'
        )
        const errors = [
          {
            row: 'bes-evidence',
            text: t('pages.cyaEvidenceForSite.validation.deleteError')
          }
        ]
        return renderSummary(h, t, { applicationId, ...draft, errors }).code(
          statusCodes.internalServerError
        )
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
        Number.parseInt(siteId, 10)
      )
    } catch (err) {
      if (err.status !== statusCodes.notFound) {
        throw err
      }
    }
    return h.redirect(manageOverseasSitesUrl(applicationId))
  }
}

function renderRequests(h, t, { applicationId, view, errors }) {
  const sites = view.activeRequest?.sites ?? []
  return h.view(VIEWS.requests, {
    pageTitle: t2(t, 'requests.title'),
    heading: t2(t, 'requests.title'),
    backLink: manageOverseasSitesUrl(applicationId),
    cancelUrl: manageOverseasSitesUrl(applicationId),
    addAnotherUrl: registeredSitesUrl(applicationId),
    requests: sites.map((site) => {
      const entry = findSite(view, site.siteId)
      return {
        siteId: site.siteId,
        orsId: site.orsId,
        siteName: site.siteName,
        address: siteAddressLine(entry.site),
        viewUrl: addToAccreditationUrl(applicationId, site.siteId)
      }
    }),
    charge: view.activeRequest ? chargeFor(view.activeRequest.charge) : null,
    errors: errors ?? []
  })
}

export const requestsGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const view = await loadView(request)
    return renderRequests(h, t, {
      applicationId: request.params.applicationId,
      view
    })
  }
}

export const requestsPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const view = await loadView(request)
    const sites = view.activeRequest?.sites ?? []
    if (sites.length === 0) {
      return h.redirect(manageOverseasSitesUrl(applicationId))
    }
    const incomplete = sites.filter((site) => site.isComplete === false)
    if (incomplete.length > 0) {
      const errors = incomplete.map((site) => ({
        href: addToAccreditationUrl(applicationId, site.siteId),
        orsId: site.orsId,
        text: t2(t, 'requests.incomplete')
          .replace('{site}', site.siteName)
          .replace('{orsId}', site.orsId)
      }))
      return renderRequests(h, t, { applicationId, view, errors }).code(
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

export const declarationPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const payload = request.payload ?? {}
    if (payload.submitAction === 'saveAndComeLater') {
      return h.redirect(manageOverseasSitesUrl(applicationId))
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
    try {
      // AC07: the backend moves the request to Submitted.
      await accreditationChangesService.submit(
        organisationIdFrom(request),
        applicationId,
        { fullName, jobTitle, email: getUser(request)?.email ?? null }
      )
    } catch (err) {
      if (err.status === statusCodes.notFound) {
        return h.redirect(manageOverseasSitesUrl(applicationId))
      }
      if (err.status === statusCodes.unprocessableEntity) {
        return h.redirect(requestsUrl(applicationId))
      }
      request.logger.error(
        { err, applicationId },
        'Error submitting in-year accreditation change request'
      )
      return h
        .view(VIEWS.declaration, {
          ...declarationViewData(t, applicationId, fullName, jobTitle),
          error: t('pages.submitDeclaration.validation.submitError')
        })
        .code(statusCodes.internalServerError)
    }
    return h.redirect(paymentUrl(applicationId))
  }
}

// f07: the existing bank-transfer payment page, charged per ORS only
// (AC03/AC04) for the most recently submitted request.
export const paymentGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { applicationId } = request.params
    const organisationId = organisationIdFrom(request)
    const view = await loadView(request)
    const submitted = view.requests.find(
      (changeRequest) => changeRequest.status === SUBMITTED
    )
    if (!submitted) {
      return h.redirect(manageOverseasSitesUrl(applicationId))
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
      backLink: manageOverseasSitesUrl(applicationId),
      backLinkText: t2(t, 'payment.backLink'),
      materialDisplay: materialDisplayName(application, t),
      submitterName: submitted.submittedBy.fullName,
      submitterEmail: submitted.submittedBy.email ?? '',
      paymentReference: buildPaymentReference(
        nation,
        application.organisationNumber,
        application.isExporter
      ),
      regulatorName: paymentDetails.companyName ?? paymentDetails.accountName,
      regulatorContact: resolveRegulatorContact(nation),
      paymentDetails
    })
  }
}
