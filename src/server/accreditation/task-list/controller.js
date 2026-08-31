import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
//import { getUser } from '../../common/helpers/auth/get-user.js'
import { ACCREDITATION_SESSION_KEYS } from '../../common/constants/accreditationSessionKeys.js'
import {
  queryTaskListUrl,
  landingUrl
} from '../../common/helpers/accreditationUrls.js'
import {
  TERMINAL_STATUSES,
  LOCKED_STATUSES
} from '../../common/helpers/accreditationSelection.js'
import { operatorHomeUrl } from '../../common/helpers/test-pages-access.js'
import { fetchApplicationOrRenderSimpleErrorPage } from '../../common/helpers/fetchApplicationOrRenderError.js'

const SECTION_STATUS_CONFIG = {
  NotStarted: { tagText: 'NOT STARTED', tagClass: 'govuk-tag--grey' },
  InProgress: { tagText: 'IN PROGRESS', tagClass: 'govuk-tag--blue' },
  Completed: { tagText: 'COMPLETED', tagClass: 'govuk-tag--green' },
  Submitted: { tagText: 'SUBMITTED', tagClass: 'govuk-tag--green' },
  Queried: { tagText: 'QUERIED', tagClass: 'govuk-tag--orange' },
  Updated: { tagText: 'UPDATED', tagClass: 'govuk-tag--turquoise' }
}

function sectionStatus(value) {
  return SECTION_STATUS_CONFIG[value] ?? SECTION_STATUS_CONFIG.NotStarted
}

// RA-481: once the application is locked (Submitted/DulyMade/Updated/
// AwaitingDecision), every already-answered section is safe to open
// read-only, and the one currently Queried stays fully editable — mirrors
// the viewable/locked logic in query-task-list/controller.js, which decides
// which tasks get a link for the Queried-application flow. NotStarted/
// InProgress sections have nothing to show and stay locked (shouldn't
// normally occur once an application has reached a locked status, since
// that only happens after a full submission).
function viewableWhenLocked(status) {
  return (
    status === 'Queried' || status === 'Completed' || status === 'Submitted'
  )
}

// Applies the locked-application task rendering on top of the ordinary
// progression-gated task, once the whole application is locked — the
// section-by-section "must complete the previous one first" gating no
// longer applies once submitted (every section was already Completed to
// get there), so this replaces it with the same queried/viewable check
// query-task-list uses.
function applyLockedRendering(task) {
  const viewable = viewableWhenLocked(task.status)
  return {
    ...task,
    url: viewable ? task.canonicalUrl : null,
    locked: !viewable,
    readOnly: viewable && task.status !== 'Queried'
  }
}

export function buildTaskListViewModel(application, t) {
  const {
    applicationId,
    prns,
    businessPlan,
    samplingPlan,
    overseasSites,
    besEvidence,
    isExporter
  } = application

  const heading = isExporter
    ? t('pages.taskList.headingPrefixExporter')
    : t('pages.taskList.headingPrefix')

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

  const backLink = landingUrl(application)

  let tasks = [
    {
      label: isExporter
        ? t('pages.taskList.tasks.perns')
        : t('pages.taskList.tasks.prns'),
      canonicalUrl: `/accreditation/tonnage/${applicationId}`,
      url: `/accreditation/tonnage/${applicationId}`,
      locked: false,
      status: prns?.sectionStatus,
      statusTagText: tonnageSt.tagText,
      statusTagClass: tonnageSt.tagClass,
      testId: 'task-prns'
    },
    {
      label: t('pages.taskList.tasks.businessPlan'),
      canonicalUrl: `/accreditation/business-plan/${applicationId}`,
      url: bpLocked ? null : `/accreditation/business-plan/${applicationId}`,
      locked: bpLocked,
      status: businessPlan?.sectionStatus,
      statusTagText: bpSt.tagText,
      statusTagClass: bpSt.tagClass,
      testId: 'task-business-plan'
    },
    {
      label: t('pages.taskList.tasks.samplingPlan'),
      canonicalUrl: `/accreditation/sampling-plan/${applicationId}`,
      url: spLocked ? null : `/accreditation/sampling-plan/${applicationId}`,
      locked: spLocked,
      status: samplingPlan?.sectionStatus,
      statusTagText: spSt.tagText,
      statusTagClass: spSt.tagClass,
      testId: 'task-sampling-plan'
    }
  ]

  let allComplete = tonnageComplete && bpComplete && spComplete
  const isSubmitted = LOCKED_STATUSES.has(application.applicationStatus)

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
        canonicalUrl: `/accreditation/select-overseas-sites/${applicationId}`,
        url: osLocked
          ? null
          : `/accreditation/select-overseas-sites/${applicationId}`,
        locked: osLocked,
        status: overseasSites?.sectionStatus,
        statusTagText: osSt.tagText,
        statusTagClass: osSt.tagClass,
        testId: 'task-overseas-sites'
      },
      {
        label: t('pages.taskList.tasks.besEvidence'),
        canonicalUrl: `/accreditation/upload-evidence-for-overseas-site/${applicationId}`,
        url: besLocked
          ? null
          : `/accreditation/upload-evidence-for-overseas-site/${applicationId}`,
        locked: besLocked,
        status: besEvidence?.sectionStatus,
        statusTagText: besSt.tagText,
        statusTagClass: besSt.tagClass,
        testId: 'task-bes-evidence'
      }
    )

    allComplete = allComplete && osComplete && besComplete
  }

  // RA-481: once locked, progression gating (bpLocked/spLocked/osLocked/
  // besLocked above) no longer applies — replace it with the queried/
  // viewable check so a locked application's tasks render read-only
  // (still viewable) except the one section currently Queried.
  if (isSubmitted) {
    tasks = tasks.map(applyLockedRendering)
  }

  const exporterIsNotNull = isExporter ?? false
  return {
    heading,
    isExporter: exporterIsNotNull,
    tasks,
    allComplete,
    continueUrl: allComplete
      ? `/accreditation/submit-declaration/${applicationId}`
      : null,
    backLink,
    saveAndComeLaterLink: operatorHomeUrl(),
    isSubmitted,
    viewPaymentDetailsLink: `/accreditation/view-payment-details/${applicationId}`
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

    const { application, errorResponse } =
      await fetchApplicationOrRenderSimpleErrorPage({
        request,
        h,
        organisationId,
        applicationId,
        template: 'accreditation/task-list/index',
        pageTitle: t('pages.taskList.title'),
        error: t('pages.taskList.loadError'),
        backLink: '/operator-accreditation'
      })
    if (errorResponse) {
      return errorResponse
    }

    if (application.applicationStatus === 'Queried') {
      return h.redirect(queryTaskListUrl(applicationId))
    }

    // RA-415 defense in depth: the session guard already blocks this route
    // once terminal, but that guard is disabled in the test environment and
    // this is a cheap second check against the same data this handler
    // already fetched.
    if (TERMINAL_STATUSES.has(application.applicationStatus)) {
      return h.redirect(landingUrl(application))
    }

    const viewModel = buildTaskListViewModel(application, t)

    return h.view('accreditation/task-list/index', {
      pageTitle: t('pages.taskList.title'),
      ...viewModel
    })
  }
}
