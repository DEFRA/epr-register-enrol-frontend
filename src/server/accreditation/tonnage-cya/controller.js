import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { queryTaskListUrl } from '../../common/helpers/accreditationUrls.js'
import {
  resolveQueriedSectionAccess,
  guardSectionWrite
} from '../../common/helpers/queriedSectionAccess.js'
import { logControllerError } from '../../common/helpers/logging/log-controller-error.js'

const TONNAGE_LABEL_KEYS = {
  UpTo500: 'pages.tonnage.options.UpTo500',
  UpTo5000: 'pages.tonnage.options.UpTo5000',
  UpTo10000: 'pages.tonnage.options.UpTo10000',
  Over10000: 'pages.tonnage.options.Over10000'
}

export function buildTonnageLabel(tonnageBand, t) {
  const key = TONNAGE_LABEL_KEYS[tonnageBand]
  return key ? t(key) : t('pages.tonnageCya.notSelected')
}

export function buildAuthorisersSummary(authorisers, t) {
  if (!authorisers || authorisers.length === 0) {
    return t('pages.tonnageCya.noneSelected')
  }
  return authorisers.map((a) => a.fullName).join(', ')
}

function taskListUrl(applicationId) {
  return `/accreditation/task-list/${applicationId}`
}

function renderPage(h, viewData) {
  return h.view('accreditation/tonnage-cya/index', viewData)
}

function buildCyaLabels(isExporter, t) {
  return {
    tonnageRowLabel: isExporter
      ? t('pages.tonnageCya.tonnageLabelExporter')
      : t('pages.tonnageCya.tonnageLabel'),
    authorisersRowLabel: isExporter
      ? t('pages.tonnageCya.authorisersLabelExporter')
      : t('pages.tonnageCya.authorisersLabel'),
    changeAuthorityContext: isExporter
      ? t('pages.tonnageCya.changeAuthorityContextExporter')
      : t('pages.tonnageCya.changeAuthorityContext')
  }
}

export const tonnageCyaGetController = {
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
      return renderPage(h, {
        pageTitle: t('pages.tonnageCya.title'),
        heading: t('pages.tonnageCya.heading'),
        backLink: taskListUrl(applicationId),
        error: t('pages.tonnageCya.validation.fetchError')
      }).code(500)
    }

    const { blocked, readOnly } = resolveQueriedSectionAccess(
      application,
      application.prns?.sectionStatus
    )
    if (blocked) {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    const isExporter = application.isExporter ?? false
    const tonnageBand = application.prns?.plannedTonnageBand ?? null
    const authorisers = application.prns?.authorisers ?? []
    const fromCYA = '?fromCYA=true'

    return renderPage(h, {
      pageTitle: t('pages.tonnageCya.title'),
      heading: t('pages.tonnageCya.heading'),
      tonnageLabel: buildTonnageLabel(tonnageBand, t),
      authorisersSummary: buildAuthorisersSummary(authorisers, t),
      changeTonnageLink: `/accreditation/tonnage/${applicationId}${fromCYA}`,
      changeAuthorityLink: `/accreditation/tonnage-authority/${applicationId}${fromCYA}`,
      backLink: taskListUrl(applicationId),
      taskListLink: taskListUrl(applicationId),
      isExporter,
      ...buildCyaLabels(isExporter, t),
      readOnly,
      isQueriedApplication: application.applicationStatus === 'Queried'
    })
  }
}

// Extracted so tonnageCyaPostController.handler stays under Sonar's 75-line
// function-length limit (javascript:S138) — pulls the fetch-failure
// error-handling branch out rather than inlining it in the handler.
function handleFetchApplicationError(h, t, applicationId, err, logger) {
  logControllerError(
    logger,
    err,
    { applicationId },
    `Error fetching application ${applicationId}`
  )
  return renderPage(h, {
    pageTitle: t('pages.tonnageCya.title'),
    heading: t('pages.tonnageCya.heading'),
    backLink: taskListUrl(applicationId),
    error: t('pages.tonnageCya.validation.fetchError')
  }).code(500)
}

// Extracted for the same reason as handleFetchApplicationError above — the
// confirm-failure branch, including the RA-481 conflict redirect.
function handleConfirmTonnageError(request, h, t, err, confirmContext) {
  const { applicationId, tonnageBand, authorisers, isExporter, fromCYA } =
    confirmContext
  logControllerError(
    request.server.logger,
    err,
    { applicationId },
    `Error confirming tonnage section ${applicationId}`
  )
  // RA-481: a 409 means the application locked between the guard check
  // above and this write landing — send the operator back to this page
  // so it re-fetches and renders read-only.
  if (err.status === statusCodes.conflict) {
    return h.redirect(request.path)
  }
  return renderPage(h, {
    pageTitle: t('pages.tonnageCya.title'),
    heading: t('pages.tonnageCya.heading'),
    tonnageLabel: buildTonnageLabel(tonnageBand, t),
    authorisersSummary: buildAuthorisersSummary(authorisers, t),
    changeTonnageLink: `/accreditation/tonnage/${applicationId}${fromCYA}`,
    changeAuthorityLink: `/accreditation/tonnage-authority/${applicationId}${fromCYA}`,
    backLink: taskListUrl(applicationId),
    taskListLink: taskListUrl(applicationId),
    isExporter,
    ...buildCyaLabels(isExporter, t),
    error: t('pages.tonnageCya.validation.confirmError')
  }).code(500)
}

export const tonnageCyaPostController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params
    const { submitAction = 'confirm' } = request.payload

    if (submitAction === 'saveAndComeLater') {
      return h.redirect(taskListUrl(applicationId))
    }

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (err) {
      return handleFetchApplicationError(
        h,
        t,
        applicationId,
        err,
        request.server.logger
      )
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
    const tonnageBand = application.prns?.plannedTonnageBand ?? null
    const authorisers = application.prns?.authorisers ?? []
    const fromCYA = '?fromCYA=true'

    try {
      await accreditationApiService.patchTonnage(
        organisationId,
        applicationId,
        {
          plannedTonnageBand: tonnageBand,
          authorisers,
          sectionStatus: 'Completed'
        }
      )
    } catch (err) {
      return handleConfirmTonnageError(request, h, t, err, {
        applicationId,
        tonnageBand,
        authorisers,
        isExporter,
        fromCYA
      })
    }

    return h.redirect(taskListUrl(applicationId))
  }
}
