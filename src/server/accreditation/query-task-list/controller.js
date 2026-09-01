import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  landingUrl,
  queryDeclarationUrl,
  reExBackLinkFromSession
} from '../../common/helpers/accreditationUrls.js'
import { resolveRegulatorQueryNote } from '../../common/helpers/regulatorQuery.js'
import { fetchApplicationOrRenderSimpleErrorPage } from '../../common/helpers/fetchApplicationOrRenderError.js'

const SECTION_STATUS_CONFIG = {
  NotStarted: { tagText: 'NOT STARTED', tagClass: 'govuk-tag--grey' },
  InProgress: { tagText: 'IN PROGRESS', tagClass: 'govuk-tag--blue' },
  Completed: { tagText: 'COMPLETED', tagClass: 'govuk-tag--green' },
  Submitted: { tagText: 'SUBMITTED', tagClass: 'govuk-tag--green' },
  Queried: { tagText: 'QUERIED', tagClass: 'govuk-tag--orange' }
}

function sectionStatus(value) {
  return SECTION_STATUS_CONFIG[value] ?? SECTION_STATUS_CONFIG.NotStarted
}

// Same five sections/URLs task-list.js links to, unfiltered by progression —
// every queried section is editable regardless of the other sections' state.
function allSectionTasks(application, t) {
  const { applicationId, prns, businessPlan, samplingPlan, isExporter } =
    application

  const tasks = [
    {
      label: isExporter
        ? t('pages.taskList.tasks.perns')
        : t('pages.taskList.tasks.prns'),
      url: `/accreditation/tonnage/${applicationId}`,
      status: prns?.sectionStatus,
      testId: 'task-prns'
    },
    {
      label: t('pages.taskList.tasks.businessPlan'),
      url: `/accreditation/business-plan/${applicationId}`,
      status: businessPlan?.sectionStatus,
      testId: 'task-business-plan'
    },
    {
      label: t('pages.taskList.tasks.samplingPlan'),
      url: `/accreditation/sampling-plan/${applicationId}`,
      status: samplingPlan?.sectionStatus,
      testId: 'task-sampling-plan'
    }
  ]

  if (isExporter) {
    const { overseasSites, besEvidence } = application
    tasks.push(
      {
        label: t('pages.taskList.tasks.overseasSites'),
        url: `/accreditation/select-overseas-sites/${applicationId}`,
        status: overseasSites?.sectionStatus,
        testId: 'task-overseas-sites'
      },
      {
        label: t('pages.taskList.tasks.besEvidence'),
        url: `/accreditation/upload-evidence-for-overseas-site/${applicationId}`,
        status: besEvidence?.sectionStatus,
        testId: 'task-bes-evidence'
      }
    )
  }

  return tasks
}

export function buildQueryTaskListViewModel(application, t) {
  const { applicationId, isExporter } = application

  const heading = isExporter
    ? t('pages.taskList.headingPrefixExporter')
    : t('pages.taskList.headingPrefix')

  const tasks = allSectionTasks(application, t).map((task) => {
    const st = sectionStatus(task.status)
    const queried = task.status === 'Queried'
    // Completed/Submitted sections are already-answered data, safe to open
    // read-only. NotStarted/InProgress sections have nothing to show, so
    // they stay locked (shouldn't normally occur once an application has
    // reached Queried, since that only happens after a full submission).
    const viewable =
      queried || task.status === 'Completed' || task.status === 'Submitted'
    return {
      label: task.label,
      url: viewable ? task.url : null,
      locked: !viewable,
      readOnly: viewable && !queried,
      statusTagText: st.tagText,
      statusTagClass: st.tagClass,
      testId: task.testId
    }
  })

  return {
    heading,
    isExporter: isExporter ?? false,
    queryNote: resolveRegulatorQueryNote(application),
    tasks,
    continueUrl: queryDeclarationUrl(applicationId)
  }
}

export const queryTaskListGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const organisationId = request.yar.get(
      ACCREDITATION_SESSION_KEYS.organisationId
    )
    const { applicationId } = request.params

    const { application, errorResponse } =
      await fetchApplicationOrRenderSimpleErrorPage({
        request,
        h,
        organisationId,
        applicationId,
        template: 'accreditation/query-task-list/index',
        pageTitle: t('pages.queryTaskList.title'),
        error: t('pages.queryTaskList.loadError'),
        backLink: reExBackLinkFromSession(request.yar)
      })
    if (errorResponse) {
      return errorResponse
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application))
    }

    const viewModel = buildQueryTaskListViewModel(application, t)

    return h.view('accreditation/query-task-list/index', {
      pageTitle: t('pages.queryTaskList.title'),
      backLink: landingUrl(application),
      ...viewModel
    })
  }
}
