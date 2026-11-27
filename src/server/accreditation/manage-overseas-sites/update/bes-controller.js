import { statusCodes } from '../../../common/constants/status-codes.js'
import {
  accreditationChangesService,
  conflictMessage
} from '../../../common/helpers/accreditationChangesService.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'
import {
  buildViewData as buildBesViewData,
  uploadRejectionErrorFromQuery
} from '../../upload-bes-evidence/controller.js'
import { besEvidenceRequired } from '../../upload-evidence-for-overseas-site/controller.js'
import {
  besFileContext,
  besUploadStatusPre,
  completeBesUpload,
  postBesUpload
} from '../bes-upload.js'
import { organisationIdFrom } from '../controller.js'
import { updateBesEvidenceUrl, updateUrl, updatedUrl } from '../urls.js'
import { detailsView, handler, refusedOnDetails, saveChange } from './shared.js'
import { BES_EVIDENCE_UPDATED } from './steps.js'

// RA-682: BES evidence can't be amended, but new evidence can be uploaded, as
// RA-492's add journey uploads it, and removed again while in the draft.

const BES_VIEW = 'accreditation/upload-bes-evidence/index'

function besHandler(run) {
  return handler({ editable: true }, (request, h, locale, loaded) => {
    const { applicationId, siteId } = request.params
    if (!besEvidenceRequired(loaded.update.entry.site)) {
      return h.redirect(updateUrl(applicationId, siteId))
    }
    return run(request, h, locale, loaded)
  })
}

function besView(h, t, request, update, payload, errors) {
  const details = updateUrl(request.params.applicationId, update.entry.siteId)
  return h.view(BES_VIEW, {
    ...buildBesViewData(
      t,
      request.params.applicationId,
      update.details.siteName ?? update.entry.site.siteName,
      payload,
      errors
    ),
    backLink: details,
    cancelUrl: details,
    taskListLink: details
  })
}

function statusUrl({ applicationId, siteId }) {
  return `${updateBesEvidenceUrl(applicationId, siteId)}/status`
}

export const besEvidenceStatusPre = besUploadStatusPre(
  ({ applicationId, siteId }) => updateBesEvidenceUrl(applicationId, siteId)
)

export const besEvidenceGetController = besHandler(
  (request, h, { t }, { update }) =>
    besView(
      h,
      t,
      request,
      update,
      {},
      {
        fileError: uploadRejectionErrorFromQuery(request, t)
      }
    )
)

export const besEvidencePostController = besHandler(
  (request, h, { t }, { view, update }) =>
    postBesUpload(request, h, t, {
      files: besFileContext(view, update.entry.site, update.item),
      render: (payload, errors) =>
        besView(h, t, request, update, payload, errors),
      statusUrl: statusUrl(request.params),
      doneUrl: updateUrl(request.params.applicationId, request.params.siteId)
    })
)

export const besEvidenceStatusController = besHandler(
  (request, h, locale, loaded) => {
    const { applicationId, siteId } = request.params
    return completeBesUpload(request, h, locale.t, {
      uploadUrl: updateBesEvidenceUrl(applicationId, siteId),
      attach: async (body) => {
        const result = await saveChange(
          request,
          h,
          loaded.update,
          (org, app, site) =>
            accreditationChangesService.addBesEvidenceFile(org, app, site, body)
        )
        if (result?.redirect) {
          return result.redirect
        }
        return result
          ? refusedOnDetails(h, request, locale, loaded, result)
          : null
      },
      doneUrl: updatedUrl(applicationId, siteId, BES_EVIDENCE_UPDATED)
    })
  }
)

export const besEvidenceFileDeleteController = handler(
  { editable: true },
  async (request, h, locale, loaded) => {
    const { applicationId, siteId, fileId } = request.params
    try {
      await accreditationChangesService.deleteBesEvidenceFile(
        organisationIdFrom(request),
        applicationId,
        siteId,
        fileId
      )
    } catch (err) {
      if (err.status === statusCodes.conflict) {
        return refusedOnDetails(h, request, locale, loaded, {
          message: conflictMessage(err)
        })
      }
      if (err.status !== statusCodes.notFound) {
        logStructuredError(
          request.logger,
          err,
          { applicationId, siteId, fileId },
          'Error deleting BES evidence file from an ORS update'
        )
        return detailsView(
          h,
          request,
          locale,
          loaded,
          locale.t('pages.cyaEvidenceForSite.validation.deleteError')
        ).code(statusCodes.internalServerError)
      }
    }
    return h.redirect(updatedUrl(applicationId, siteId, BES_EVIDENCE_UPDATED))
  }
)
