import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'
import {
  parseDate,
  resolveBesEvidenceValidTo,
  taskListUrl,
  cyaEvidenceUrl,
  FETCH_ERROR_KEY
} from './controller.js'

// RA-570 (SonarCloud S104): split out of controller.js, which had grown past
// the file-length threshold once the amend routes were added. This file
// covers the amend-a-single-file flow only - deletion stays a separate
// action on the review screen (cya-evidence-for-overseas-site), and a fresh
// upload stays in controller.js.

function renderAmendPage(h, viewData) {
  return h.view('accreditation/upload-bes-evidence/amend', viewData)
}

// Splits an ISO date string back into the day/month/year fields the amend
// form (and parseDate/isDateBlank) expect, so an existing file's dates can
// be pre-filled for editing.
function isoToDateParts(isoString) {
  if (!isoString) {
    return { day: '', month: '', year: '' }
  }
  const date = new Date(isoString)
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear())
  }
}

function findBesEvidenceFile(application, siteIdInt, fileId) {
  const site = application.overseasSites?.sites?.find(
    (s) => s.siteId === siteIdInt
  )
  const upload = site?.besEvidence?.besEvidenceUploads?.find(
    (u) => u.fileId === fileId
  )
  return { site, upload }
}

function buildAmendViewData({
  t,
  applicationId,
  siteId,
  siteName,
  fileId,
  filename,
  payload,
  errors
}) {
  return {
    pageTitle: t('pages.uploadBesEvidence.amend.title'),
    heading: `${t('pages.uploadBesEvidence.amend.heading')} ${siteName}`,
    backLink: cyaEvidenceUrl(applicationId, siteId),
    taskListLink: taskListUrl(applicationId),
    cancelLink: cyaEvidenceUrl(applicationId, siteId),
    siteName,
    fileId,
    filename,
    validFromDay: payload?.validFromDay ?? '',
    validFromMonth: payload?.validFromMonth ?? '',
    validFromYear: payload?.validFromYear ?? '',
    validToDay: payload?.validToDay ?? '',
    validToMonth: payload?.validToMonth ?? '',
    validToYear: payload?.validToYear ?? '',
    ...errors
  }
}

// Extracted from besEvidenceAmendPostController (SonarCloud cognitive
// complexity): validates both amend-form dates in one place and returns
// either the resolved ISO dates or the render-ready field error, so the
// handler doesn't nest two separate validation branches itself.
function resolveAmendDates(payload, t) {
  const validFrom = parseDate(
    payload.validFromDay,
    payload.validFromMonth,
    payload.validFromYear
  )
  if (!validFrom) {
    return {
      errors: {
        validFromError: t(
          'pages.uploadBesEvidence.validation.validFromRequired'
        )
      }
    }
  }

  const { validTo, error: validToError } = resolveBesEvidenceValidTo(
    payload,
    validFrom,
    t
  )
  if (validToError) {
    return { errors: { validToError } }
  }

  return {
    besEvidenceValidFromDate: validFrom.toISOString(),
    besEvidenceExpiryDate: validTo ? validTo.toISOString() : null
  }
}

// Maps an existing upload's ISO dates to the day/month/year payload shape
// buildAmendViewData/parseDate expect, so the GET and POST handlers below
// pre-fill and re-render the form the same way.
function amendFormPayloadFromUpload(upload) {
  const from = isoToDateParts(upload.besEvidenceValidFromDate)
  const to = isoToDateParts(upload.besEvidenceExpiryDate)
  return {
    validFromDay: from.day,
    validFromMonth: from.month,
    validFromYear: from.year,
    validToDay: to.day,
    validToMonth: to.month,
    validToYear: to.year
  }
}

export const besEvidenceAmendGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId, fileId } = request.params
    const siteIdInt = Number.parseInt(siteId, 10)

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderAmendPage(
          h,
          buildAmendViewData({
            t,
            applicationId,
            siteId,
            siteName: '',
            fileId,
            filename: '',
            payload: {},
            errors: {
              error: t(FETCH_ERROR_KEY)
            }
          })
        ).code(statusCodes.internalServerError)
    })
    if (errorResponse) {
      return errorResponse
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.besEvidence?.sectionStatus
    )
    if (blocked || readOnly) {
      return h.redirect(
        blocked
          ? queryTaskListUrl(applicationId)
          : cyaEvidenceUrl(applicationId, siteId)
      )
    }

    const { site, upload } = findBesEvidenceFile(application, siteIdInt, fileId)
    if (!upload) {
      return h.redirect(cyaEvidenceUrl(applicationId, siteId))
    }
    const siteName = site?.siteName ?? ''

    return renderAmendPage(
      h,
      buildAmendViewData({
        t,
        applicationId,
        siteId,
        siteName,
        fileId,
        filename: upload.filename ?? '',
        payload: amendFormPayloadFromUpload(upload),
        errors: {}
      })
    )
  }
}

// Extracted from besEvidenceAmendPostController's handler (SonarCloud
// function-length): the updateBesEvidenceFile failure branching (409 lock
// race vs. a re-rendered service-error) doesn't need to live inline.
function handleAmendPatchError(
  h,
  t,
  err,
  { request, applicationId, siteId, siteName, fileId, filename, payload }
) {
  logStructuredError(
    request.server.logger,
    err,
    { siteId, applicationId, fileId },
    `Error amending BES evidence file ${fileId} for site ${siteId}, application ${applicationId}`
  )
  if (err.status === statusCodes.conflict) {
    return h.redirect(request.path)
  }
  return renderAmendPage(
    h,
    buildAmendViewData({
      t,
      applicationId,
      siteId,
      siteName,
      fileId,
      filename,
      payload,
      errors: { error: t('pages.uploadBesEvidence.validation.amendError') }
    })
  ).code(statusCodes.internalServerError)
}

export const besEvidenceAmendPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId, siteId, fileId } = request.params
    const siteIdInt = Number.parseInt(siteId, 10)
    const payload = request.payload ?? {}

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderAmendPage(
          h,
          buildAmendViewData({
            t,
            applicationId,
            siteId,
            siteName: '',
            fileId,
            filename: '',
            payload,
            errors: {
              error: t(FETCH_ERROR_KEY)
            }
          })
        ).code(statusCodes.internalServerError)
    })
    if (errorResponse) {
      return errorResponse
    }

    const guardRedirect = guardSectionWrite({
      h,
      application,
      sectionStatus: application.besEvidence?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const { site, upload } = findBesEvidenceFile(application, siteIdInt, fileId)
    if (!upload) {
      return h.redirect(cyaEvidenceUrl(applicationId, siteId))
    }
    const siteName = site?.siteName ?? ''
    const filename = upload.filename ?? ''

    const dates = resolveAmendDates(payload, t)
    if (dates.errors) {
      return renderAmendPage(
        h,
        buildAmendViewData({
          t,
          applicationId,
          siteId,
          siteName,
          fileId,
          filename,
          payload,
          errors: dates.errors
        })
      ).code(statusCodes.badRequest)
    }

    try {
      await accreditationApiService.updateBesEvidenceFile(
        organisationId,
        applicationId,
        siteIdInt,
        fileId,
        {
          besEvidenceValidFromDate: dates.besEvidenceValidFromDate,
          besEvidenceExpiryDate: dates.besEvidenceExpiryDate
        }
      )
    } catch (err) {
      return handleAmendPatchError(h, t, err, {
        request,
        applicationId,
        siteId,
        siteName,
        fileId,
        filename,
        payload
      })
    }

    return h.redirect(cyaEvidenceUrl(applicationId, siteId))
  }
}
