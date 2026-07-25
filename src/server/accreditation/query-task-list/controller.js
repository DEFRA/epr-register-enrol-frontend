import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  landingUrl,
  queryDeclarationUrl
} from '../../common/helpers/accreditationUrls.js'

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

const GLASS_RECYCLING_PROCESS_KEYS = {
  glass_re_melt: 'pages.materialSelection.glassRemelt',
  glass_other: 'pages.materialSelection.glassOther'
}

function materialDisplayName(application, t) {
  const { materialType, glassRecyclingProcess } = application
  if (!materialType) return ''

  const glassKey = GLASS_RECYCLING_PROCESS_KEYS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassKey) return t(glassKey)

  return t(`pages.materialSelection.materials.${materialType}`)
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
  const { applicationId, year, isExporter } = application

  const materialDisplay = materialDisplayName(application, t)
  const headingPrefix = isExporter
    ? t('pages.taskList.headingPrefixExporter')
    : t('pages.taskList.headingPrefix')
  const heading = `${headingPrefix} ${materialDisplay} ${t('pages.taskList.headingSuffix')}`

  const tasks = allSectionTasks(application, t)
    .filter((task) => task.status === 'Queried')
    .map((task) => {
      const st = sectionStatus(task.status)
      return {
        label: task.label,
        url: task.url,
        locked: false,
        statusTagText: st.tagText,
        statusTagClass: st.tagClass,
        testId: task.testId
      }
    })

  return {
    heading,
    isExporter: isExporter ?? false,
    metadata: { year },
    queryNote: application.query?.queryNote ?? null,
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

    let application
    try {
      application = await accreditationApiService.getApplication(
        organisationId,
        applicationId
      )
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation application ${applicationId}: ${error.message}`
      )
      return h
        .view('accreditation/query-task-list/index', {
          pageTitle: t('pages.queryTaskList.title'),
          error: t('pages.queryTaskList.loadError'),
          backLink: '/operator-accreditation'
        })
        .code(500)
    }

    if (application.applicationStatus !== 'Queried') {
      return h.redirect(landingUrl(application, application.isExporter))
    }

    const viewModel = buildQueryTaskListViewModel(application, t)

    return h.view('accreditation/query-task-list/index', {
      pageTitle: t('pages.queryTaskList.title'),
      backLink: landingUrl(application, application.isExporter),
      ...viewModel
    })
  }
}
