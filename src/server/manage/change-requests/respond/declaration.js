import { statusCodes } from '../../../common/constants/status-codes.js'
import { accreditationChangesService } from '../../../common/helpers/accreditationChangesService.js'
import { getUser } from '../../../common/helpers/auth/get-user.js'
import { logStructuredError } from '../../../common/helpers/logging/log-structured-error.js'
import {
  buildViewData,
  validateDeclaration
} from '../../../accreditation/submit-declaration/controller.js'
import { manageUrl } from '../../helpers/manage-urls.js'
import { loadQueriedItem } from './load.js'
import { FLASH_PROBLEM } from './steps.js'

// RA-698: the declaration that answers the query. No fee is due, so a
// successful resubmit goes straight back to the manage page.

const VIEW = 'accreditation/submit-declaration/index'

export const MANAGE_NOTIFICATION = 'notification'

function viewData(ctx, fullName, jobTitle) {
  return {
    ...buildViewData(ctx.t, ctx.applicationId, fullName, jobTitle),
    backLink: ctx.itemUrl,
    submitButtonText: ctx.t(
      'pages.manageChangeRequests.respond.declaration.confirm'
    )
  }
}

function backWithProblem(ctx, h, key) {
  ctx.request.yar.flash(
    FLASH_PROBLEM,
    ctx.t(`pages.manageChangeRequests.respond.${key}`)
  )
  return h.redirect(ctx.itemUrl)
}

// Required BES evidence has to be in place before the response can be sent.
const isMissingBes = (item) => item.missingFields?.includes('besEvidence')

export const declarationGetController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    if (isMissingBes(ctx.item)) {
      return backWithProblem(ctx, h, 'besRequired')
    }
    return h.view(VIEW, viewData(ctx, '', ''))
  }
}

export const declarationPostController = {
  async handler(request, h) {
    const { ctx, response } = await loadQueriedItem(request, h)
    if (response) {
      return response
    }
    const { t } = ctx
    const payload = request.payload ?? {}
    if (payload.submitAction === 'saveAndComeLater') {
      return h.redirect(ctx.itemUrl)
    }
    if (isMissingBes(ctx.item)) {
      return backWithProblem(ctx, h, 'besRequired')
    }
    const fullName = (payload.fullName ?? '').trim()
    const jobTitle = (payload.jobTitle ?? '').trim()
    const errors = validateDeclaration(fullName, jobTitle, t)
    if (Object.keys(errors).length > 0) {
      return h
        .view(VIEW, { ...viewData(ctx, fullName, jobTitle), errors })
        .code(statusCodes.badRequest)
    }
    try {
      await accreditationChangesService.resubmitItem(
        ctx.organisationId,
        ctx.applicationId,
        ctx.item.itemId,
        { fullName, jobTitle, email: getUser(request)?.email ?? null }
      )
    } catch (err) {
      // 409: no longer Queried (another tab answered it).
      if (err.status === statusCodes.conflict) {
        return h.redirect(ctx.itemUrl)
      }
      // 422: nothing has changed since the query.
      if (err.status === statusCodes.unprocessableEntity) {
        return backWithProblem(ctx, h, 'nothingChanged')
      }
      logStructuredError(
        request.logger,
        err,
        { itemId: ctx.item.itemId },
        'Error answering a query on an in-year change request item'
      )
      return h
        .view(VIEW, {
          ...viewData(ctx, fullName, jobTitle),
          error: t('pages.submitDeclaration.validation.submitError')
        })
        .code(statusCodes.internalServerError)
    }
    request.yar.flash(
      MANAGE_NOTIFICATION,
      t('pages.manageChangeRequests.respond.requestUpdated')
    )
    return h.redirect(manageUrl(request.params, ctx.currentLocale))
  }
}
