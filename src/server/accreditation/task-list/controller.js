import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
//import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'

const SECTION_STATUS_CONFIG = {
  NotStarted: { tagText: 'NOT STARTED', tagClass: 'govuk-tag--grey' },
  InProgress: { tagText: 'IN PROGRESS', tagClass: 'govuk-tag--blue' },
  Completed: { tagText: 'COMPLETED', tagClass: 'govuk-tag--green' }
}

function sectionStatus(value) {
  return SECTION_STATUS_CONFIG[value] ?? SECTION_STATUS_CONFIG.NotStarted
}

export function buildTaskListViewModel(application, t) {
  const {
    applicationId,
    materialType,
    year,
    siteId,
    siteAddress,
    organisationId,
    prns,
    businessPlan,
    samplingPlan,
    overseasSites,
    besEvidence,
    isExporter
  } = application

  const materialDisplay = t(`pages.materialSelection.materials.${materialType}`)
  const headingPrefix = isExporter
    ? t('pages.taskList.headingPrefixExporter')
    : t('pages.taskList.headingPrefix')
  const heading = `${headingPrefix} ${materialDisplay} ${t('pages.taskList.headingSuffix')}`

  const tonnageComplete = (prns?.sectionStatus ?? 'NotStarted') === 'Completed'
  const bpComplete =
    (businessPlan?.sectionStatus ?? 'NotStarted') === 'Completed'
  const spComplete =
    (samplingPlan?.sectionStatus ?? 'NotStarted') === 'Completed'

  const bpLocked = !tonnageComplete
  const spLocked = !bpComplete

  const tonnageSt = sectionStatus(prns?.sectionStatus)
  const bpSt = sectionStatus(businessPlan?.sectionStatus)
  const spSt = sectionStatus(samplingPlan?.sectionStatus)

  const backLink = isExporter
    ? `/operator-accreditation/${organisationId}/${materialType}/${year}`
    : `/operator-accreditation/${organisationId}/${siteId}/${materialType}/${year}`

  const tasks = [
    {
      label: isExporter
        ? t('pages.taskList.tasks.perns')
        : t('pages.taskList.tasks.prns'),
      url: `/accreditation/tonnage/${applicationId}`,
      locked: false,
      statusTagText: tonnageSt.tagText,
      statusTagClass: tonnageSt.tagClass,
      testId: 'task-prns'
    },
    {
      label: t('pages.taskList.tasks.businessPlan'),
      url: bpLocked ? null : `/accreditation/business-plan/${applicationId}`,
      locked: bpLocked,
      statusTagText: bpSt.tagText,
      statusTagClass: bpSt.tagClass,
      testId: 'task-business-plan'
    },
    {
      label: t('pages.taskList.tasks.samplingPlan'),
      url: spLocked ? null : `/accreditation/sampling-plan/${applicationId}`,
      locked: spLocked,
      statusTagText: spSt.tagText,
      statusTagClass: spSt.tagClass,
      testId: 'task-sampling-plan'
    }
  ]

  let allComplete = tonnageComplete && bpComplete && spComplete

  if (isExporter) {
    const osComplete =
      (overseasSites?.sectionStatus ?? 'NotStarted') === 'Completed'
    const besComplete =
      (besEvidence?.sectionStatus ?? 'NotStarted') === 'Completed'
    const osLocked = !spComplete
    const besLocked = !osComplete

    const osSt = sectionStatus(overseasSites?.sectionStatus)
    const besSt = sectionStatus(besEvidence?.sectionStatus)

    tasks.push(
      {
        label: t('pages.taskList.tasks.overseasSites'),
        url: osLocked
          ? null
          : `/accreditation/select-overseas-sites/${applicationId}`,
        locked: osLocked,
        statusTagText: osSt.tagText,
        statusTagClass: osSt.tagClass,
        testId: 'task-overseas-sites'
      },
      {
        label: t('pages.taskList.tasks.besEvidence'),
        url: besLocked
          ? null
          : `/accreditation/upload-evidence-for-overseas-site/${applicationId}`,
        locked: besLocked,
        statusTagText: besSt.tagText,
        statusTagClass: besSt.tagClass,
        testId: 'task-bes-evidence'
      }
    )

    allComplete = allComplete && osComplete && besComplete
  }
  const exporterIsNotNull = isExporter ?? false
  return {
    heading,
    isExporter: exporterIsNotNull,
    metadata: {
      year,
      site: exporterIsNotNull ? null : (siteAddress ?? t('pages.taskList.siteNotSet'))
    },
    tasks,
    allComplete,
    continueUrl: allComplete
      ? `/accreditation/submit-declaration/${applicationId}`
      : null,
    backLink,
    saveAndComeLaterLink: '/operator'
  }
}

export const taskListGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    //const user = getUser(request)

    // const organisationId = user?.id
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
        .view('accreditation/task-list/index', {
          pageTitle: t('pages.taskList.title'),
          error: t('pages.taskList.loadError'),
          backLink: '/operator-accreditation'
        })
        .code(500)
    }

    const viewModel = buildTaskListViewModel(application, t)

    return h.view('accreditation/task-list/index', {
      pageTitle: t('pages.taskList.title'),
      ...viewModel
    })
  }
}
