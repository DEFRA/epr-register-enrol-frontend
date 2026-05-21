import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
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
    ApplicationId: applicationId,
    MaterialType: materialType,
    Year: year,
    // siteId,
    SiteAddress: siteAddress,
    Prns: prns,
    BusinessPlan: businessPlan,
    SamplingPlan: samplingPlan
  } = application

  const materialDisplay = t(`pages.materialSelection.materials.${materialType}`)
  const heading = `${t('pages.taskList.headingPrefix')} ${materialDisplay} ${t('pages.taskList.headingSuffix')}`

  const prnsComplete = (prns?.SectionStatus ?? 'NotStarted') === 'Completed'
  const bpComplete =
    (businessPlan?.SectionStatus ?? 'NotStarted') === 'Completed'
  const spComplete =
    (samplingPlan?.SectionStatus ?? 'NotStarted') === 'Completed'

  const bpLocked = !prnsComplete
  const spLocked = !bpComplete
  const allComplete = prnsComplete && bpComplete && spComplete

  const prnsSt = sectionStatus(prns?.SectionStatus)
  const bpSt = sectionStatus(businessPlan?.SectionStatus)
  const spSt = sectionStatus(samplingPlan?.SectionStatus)
  const backlink = `/operator-accreditation/${application.OrganisationId}/${application.SiteId}/${application.MaterialType}/${application.Year}`
  const saveAndComeLaterlink = `/operator`

  return {
    heading,
    metadata: {
      year: year,
      site: siteAddress ?? t('pages.taskList.siteNotSet')
    },
    tasks: [
      {
        label: t('pages.taskList.tasks.prns'),
        url: `/accreditation/prns-tonnage/${applicationId}`,
        locked: false,
        statusTagText: prnsSt.tagText,
        statusTagClass: prnsSt.tagClass,
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
    ],
    allComplete,
    continueUrl: allComplete
      ? `/accreditation/submit-declaration/${applicationId}`
      : null,
    backLink: backlink,
    saveAndComeLaterLink: saveAndComeLaterlink
  }
}

export const taskListGetController = {
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
