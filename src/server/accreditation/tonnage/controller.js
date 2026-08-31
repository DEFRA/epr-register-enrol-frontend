import Joi from 'joi'
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
import { materialDisplayName } from '../../common/helpers/materialDisplayName.js'
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'
import { fetchApplicationOrRenderError } from '../../common/helpers/fetchApplicationOrRenderError.js'

export const TONNAGE_OPTIONS = ['UpTo500', 'UpTo5000', 'UpTo10000', 'Over10000']

// Deliberately checks shape/size, not the exact enum values: the controller
// already renders its own friendly inline error for a missing or business-
// invalid plannedTonnageBand/submitAction (see the tests above), and a hard
// Joi .valid() reject would replace that with a bare Boom 400 page instead.
// Joi's job here is only to reject payloads the controller was never built
// to handle safely — wrong types, absurd lengths (M1, 2026-08-08 pentest
// report) — .unknown(true) lets the CSRF crumb field and anything else
// Hapi/Crumb add to the payload through.
export const tonnagePayloadSchema = Joi.object({
  plannedTonnageBand: Joi.string().max(50).optional(),
  submitAction: Joi.string().max(50).optional()
}).unknown(true)

export function buildTonnageOptions(selectedTonnage, t) {
  return TONNAGE_OPTIONS.map((value) => ({
    value,
    text: t(`pages.tonnage.options.${value}`),
    checked: selectedTonnage === value
  }))
}

function buildHeading(application, isExporter, t) {
  const prefix = t('pages.tonnage.headingPrefix')
  const suffix = isExporter
    ? t('pages.tonnage.headingSuffixExporter')
    : t('pages.tonnage.headingSuffix')
  const material = application ? materialDisplayName(application, t) : ''
  if (!material) {
    return `${prefix} ${suffix}`
  }
  return `${prefix} ${material} ${suffix}`
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderForm(h, viewData) {
  return h.view('accreditation/tonnage/index', viewData)
}

export const tonnageGetController = {
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
        renderForm(h, {
          pageTitle: t('pages.tonnage.title'),
          heading: buildHeading(null, false, t),
          tonnageOptions: buildTonnageOptions(null, t),
          backLink: taskListUrl(applicationId),
          error: t('pages.tonnage.validation.fetchError')
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.prns?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const isExporter = application.isExporter ?? false
    const sectionKey = isExporter ? 'perns' : 'prns'
    const queryNote = resolveRegulatorQueryNote(application, { readOnly })

    return renderForm(h, {
      pageTitle: isExporter
        ? t('pages.tonnage.titleExporter')
        : t('pages.tonnage.title'),
      heading: buildHeading(application, isExporter, t),
      tonnageOptions: buildTonnageOptions(
        application.prns?.plannedTonnageBand ?? null,
        t
      ),
      // RA-481: only route back to the query task list while the
      // application itself is mid-query — a locked-but-not-queried
      // application (e.g. Submitted) is read-only for a different reason
      // and belongs back on the ordinary task list, which renders read-only
      // in that case too.
      backLink:
        application.applicationStatus === 'Queried'
          ? queryTaskListUrl(applicationId)
          : taskListUrl(applicationId),
      isExporter,
      queryNote,
      querySummary: queryNote
        ? buildRegulatorQuerySummary(sectionKey, t)
        : null,
      readOnly,
      isQueriedApplication: application.applicationStatus === 'Queried'
    })
  }
}

// Extracted from tonnagePostController (SonarCloud cognitive complexity):
// the 409/5xx/other three-way error response was inlined in the handler's
// catch block.
function handleTonnageSaveError({
  h,
  request,
  t,
  error,
  applicationId,
  isExporter,
  heading,
  plannedTonnageBand
}) {
  logControllerError(
    request.server.logger,
    error,
    { applicationId },
    `Error saving tonnage ${applicationId}`
  )
  // RA-481: a 409 means the application locked between the guard check
  // above and this write landing — send the operator back to the
  // section's own page so it re-fetches and renders read-only.
  if (error.status === statusCodes.conflict) {
    return h.redirect(request.path)
  }
  if (!error.status || error.status >= 500) {
    return h
      .view('errors/service-problem', {
        pageTitle: t('common.errors.serviceTitle'),
        retryUrl: request.path
      })
      .code(500)
  }
  return renderForm(h, {
    pageTitle: isExporter
      ? t('pages.tonnage.titleExporter')
      : t('pages.tonnage.title'),
    heading,
    tonnageOptions: buildTonnageOptions(plannedTonnageBand, t),
    backLink: taskListUrl(applicationId),
    isExporter,
    errors: {
      plannedTonnageBand: {
        text: t('pages.tonnage.validation.saveError')
      }
    }
  }).code(400)
}

export const tonnagePostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { plannedTonnageBand, submitAction = 'saveAndContinue' } =
      request.payload

    const { application, errorResponse } = await fetchApplicationOrRenderError({
      request,
      organisationId,
      applicationId,
      renderErrorResponse: () =>
        renderForm(h, {
          pageTitle: t('pages.tonnage.title'),
          heading: buildHeading(null, false, t),
          tonnageOptions: buildTonnageOptions(null, t),
          backLink: taskListUrl(applicationId),
          errors: {
            plannedTonnageBand: {
              text: t('pages.tonnage.validation.fetchError')
            }
          }
        }).code(500)
    })
    if (errorResponse) {
      return errorResponse
    }

    const guardRedirect = guardSectionWrite({
      h,
      application,
      sectionStatus: application.prns?.sectionStatus,
      applicationId,
      ownPageUrl: request.path
    })
    if (guardRedirect) {
      return guardRedirect
    }

    const isExporter = application.isExporter ?? false
    const heading = buildHeading(application, isExporter, t)
    const selectTonnageKey = isExporter
      ? 'pages.tonnage.validation.selectTonnageExporter'
      : 'pages.tonnage.validation.selectTonnage'

    if (!plannedTonnageBand || !TONNAGE_OPTIONS.includes(plannedTonnageBand)) {
      return renderForm(h, {
        pageTitle: isExporter
          ? t('pages.tonnage.titleExporter')
          : t('pages.tonnage.title'),
        heading,
        tonnageOptions: buildTonnageOptions(null, t),
        backLink: taskListUrl(applicationId),
        isExporter,
        errors: {
          plannedTonnageBand: {
            text: t(selectTonnageKey)
          }
        }
      }).code(400)
    }

    const isSaveAndComeLater = submitAction === 'saveAndComeLater'

    try {
      await accreditationApiService.patchTonnage(
        organisationId,
        applicationId,
        {
          plannedTonnageBand,
          ...(isSaveAndComeLater ? { sectionStatus: 'InProgress' } : {})
        }
      )
    } catch (error) {
      return handleTonnageSaveError({
        h,
        request,
        t,
        error,
        applicationId,
        isExporter,
        heading,
        plannedTonnageBand
      })
    }

    if (isSaveAndComeLater) {
      return h.redirect(taskListUrl(applicationId))
    }

    return h.redirect(`/accreditation/tonnage-authority/${applicationId}`)
  }
}
