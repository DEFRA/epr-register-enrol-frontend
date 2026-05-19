import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'

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
    ApplicationId,
    MaterialType,
    Year,
    SiteId,
    SiteAddress,
    OrganisationId,
    Tonnage,
    BusinessPlan,
    SamplingPlan,
    OverseasSites,
    BesEvidence,
    IsExporter
  } = application

  const materialDisplay = t(`pages.materialSelection.materials.${MaterialType}`)
  const headingPrefix = IsExporter
    ? t('pages.taskList.headingPrefixExporter')
    : t('pages.taskList.headingPrefix')
  const heading = `${headingPrefix} ${materialDisplay} ${t('pages.taskList.headingSuffix')}`

  const tonnageComplete =
    (Tonnage?.SectionStatus ?? 'NotStarted') === 'Completed'
  const bpComplete =
    (BusinessPlan?.SectionStatus ?? 'NotStarted') === 'Completed'
  const spComplete =
    (SamplingPlan?.SectionStatus ?? 'NotStarted') === 'Completed'

  const bpLocked = !tonnageComplete
  const spLocked = !bpComplete

  const tonnageSt = sectionStatus(Tonnage?.SectionStatus)
  const bpSt = sectionStatus(BusinessPlan?.SectionStatus)
  const spSt = sectionStatus(SamplingPlan?.SectionStatus)

  const backLink = IsExporter
    ? `/operator-accreditation/${OrganisationId}/${MaterialType}/${Year}`
    : `/operator-accreditation/${OrganisationId}/${SiteId}/${MaterialType}/${Year}`

  const tasks = [
    {
      label: IsExporter
        ? t('pages.taskList.tasks.perns')
        : t('pages.taskList.tasks.prns'),
      url: `/accreditation/tonnage/${ApplicationId}`,
      locked: false,
      statusTagText: tonnageSt.tagText,
      statusTagClass: tonnageSt.tagClass,
      testId: 'task-prns'
    },
    {
      label: t('pages.taskList.tasks.businessPlan'),
      url: bpLocked ? null : `/accreditation/business-plan/${ApplicationId}`,
      locked: bpLocked,
      statusTagText: bpSt.tagText,
      statusTagClass: bpSt.tagClass,
      testId: 'task-business-plan'
    },
    {
      label: t('pages.taskList.tasks.samplingPlan'),
      url: spLocked ? null : `/accreditation/sampling-plan/${ApplicationId}`,
      locked: spLocked,
      statusTagText: spSt.tagText,
      statusTagClass: spSt.tagClass,
      testId: 'task-sampling-plan'
    }
  ]

  let allComplete = tonnageComplete && bpComplete && spComplete

  if (IsExporter) {
    const osComplete =
      (OverseasSites?.SectionStatus ?? 'NotStarted') === 'Completed'
    const besComplete =
      (BesEvidence?.SectionStatus ?? 'NotStarted') === 'Completed'
    const osLocked = !spComplete
    const besLocked = !osComplete

    const osSt = sectionStatus(OverseasSites?.SectionStatus)
    const besSt = sectionStatus(BesEvidence?.SectionStatus)

    tasks.push(
      {
        label: t('pages.taskList.tasks.overseasSites'),
        url: osLocked
          ? null
          : `/accreditation/select-overseas-sites/${ApplicationId}`,
        locked: osLocked,
        statusTagText: osSt.tagText,
        statusTagClass: osSt.tagClass,
        testId: 'task-overseas-sites'
      },
      {
        label: t('pages.taskList.tasks.besEvidence'),
        url: besLocked
          ? null
          : `/accreditation/upload-evidence-for-overseas-site/${ApplicationId}`,
        locked: besLocked,
        statusTagText: besSt.tagText,
        statusTagClass: besSt.tagClass,
        testId: 'task-bes-evidence'
      }
    )

    allComplete = allComplete && osComplete && besComplete
  }

  return {
    heading,
    isExporter: IsExporter ?? false,
    metadata: {
      year: Year,
      site: IsExporter ? null : (SiteAddress ?? t('pages.taskList.siteNotSet'))
    },
    tasks,
    allComplete,
    continueUrl: allComplete
      ? `/accreditation/submit-declaration/${ApplicationId}`
      : null,
    backLink,
    saveAndComeLaterLink: '/operator'
  }
}

export const taskListGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id
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
