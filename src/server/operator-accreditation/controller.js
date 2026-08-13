import Boom from '@hapi/boom'

import { config } from '../../config/config.js'
import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { ACCREDITATION_SESSION_KEYS } from '../common/constants/accreditationSessionKeys.js'
import {
  queryTaskListUrl,
  landingUrl
} from '../common/helpers/accreditationUrls.js'
import { materialDisplayName } from '../common/helpers/materialDisplayName.js'
import { buildApplicationHeaderViewModel } from '../common/helpers/applicationHeader.js'
import {
  WITHDRAWN_STATUS,
  NON_WITHDRAWABLE_STATUSES,
  TERMINAL_STATUSES,
  resolveLandingApplication
} from '../common/helpers/accreditationSelection.js'

// RA-357: restarting after a withdrawal is a mutation, so it is a POST to
// /start-new carrying a crumb token — never a flag on this GET. A GET would be
// both CSRF-able (no token) and replayable from history, bookmarks or prefetch,
// silently creating an application every time it was re-visited.
const START_NEW_SEGMENT = '/start-new'

const STATUS_CONFIG = {
  Saved: { tagClass: 'govuk-tag--grey' },
  Started: { tagClass: 'govuk-tag--blue' },
  NotStarted: { tagClass: 'govuk-tag--grey' },
  InProgress: { tagClass: 'govuk-tag--blue' },
  Submitted: { tagClass: 'govuk-tag--green' },
  DulyMade: { tagClass: 'govuk-tag--turquoise' },
  Queried: { tagClass: 'govuk-tag--orange' },
  Updated: { tagClass: 'govuk-tag--turquoise' },
  AwaitingDecision: { tagClass: 'govuk-tag--purple' },
  Approved: { tagClass: 'govuk-tag--green' },
  Rejected: { tagClass: 'govuk-tag--red' },
  Withdrawn: { tagClass: 'govuk-tag--grey' }
}

// The reapply prompt only makes sense while an application is still live —
// once it's been decided (approved/refused) or dropped (withdrawn/cancelled)
// there's nothing left to reapply for.
const REAPPLY_TEXT_HIDDEN_STATUSES = new Set([
  'Saved',
  'Started',
  'NotStarted',
  'Approved',
  'Withdrawn',
  'Cancelled',
  'Refused',
  'Rejected'
])

// The prior accreditation year always runs to 31 December.
function buildCurrentAccreditation(application, siteName, priorYear) {
  const accreditation = application.organisation?.accreditation
  if (!accreditation) return null

  return {
    accreditationNumber: accreditation.accreditationNumber,
    regulator: accreditation.regulator,
    status: 'Approved',
    statusTagClass: STATUS_CONFIG.Approved.tagClass,
    expiryDate: `31 December ${priorYear}`,
    siteAddress: siteName,
    tonnage: accreditation.tonnage,
    authorisedUsers: accreditation.authorisedUsers ?? [],
    overseasSites: accreditation.overseasSites ?? []
  }
}

export function buildLandingViewModel(
  application,
  organisationName,
  siteAddress,
  accreditationYear,
  t,
  isExporter = false
) {
  const config = STATUS_CONFIG[application.applicationStatus] ?? {
    tagClass: ''
  }
  const matDisp = materialDisplayName(application, t)
  const siteName = isExporter
    ? t('pages.operatorAccreditation.exporterLabel')
    : (siteAddress ?? t('pages.taskList.siteNotSet'))
  const priorYear = accreditationYear - 1
  return {
    organisationName,
    accreditationYear,
    registrationId:
      application.registrationId ?? application.applicationReference,
    siteName,
    pageHeading: t('pages.operatorAccreditation.reapplyHeading'),
    materialDisplay: matDisp,
    statusLabel: t(
      `pages.operatorAccreditation.statuses.${application.applicationStatus}`
    ),
    statusTagClass: config.tagClass,
    // RA-415: sourced from CM's SLA due date (OJ-BE's WorkItemDetailResponseDto
    // -> AccreditationApplicationModel.DueDate), null until the application has
    // a linked CM work item — see dueDateNotAvailable fallback in the template.
    dueDate: application.dueDate ?? null,
    currentAccreditation: buildCurrentAccreditation(
      application,
      siteName,
      priorYear
    ),
    taskListUrl:
      application.applicationStatus === 'Queried'
        ? queryTaskListUrl(application.applicationId)
        : `/accreditation/task-list/${application.applicationId}`,
    showContinueLink: !TERMINAL_STATUSES.has(application.applicationStatus),
    canWithdraw: !NON_WITHDRAWABLE_STATUSES.has(application.applicationStatus),
    withdrawUrl: `/accreditation/withdraw-application/${application.applicationId}`,
    // RA-357: starting again after a withdrawal creates a new application for
    // the SAME accreditation year — the withdrawn record is kept untouched for
    // audit. This used to link to accreditationYear + 1, which seeded against a
    // prior year that has no approved accreditation and always failed.
    // This is the action of a POST form, not an anchor href — see
    // START_NEW_SEGMENT above.
    startNewUrl:
      application.applicationStatus === WITHDRAWN_STATUS
        ? `${landingUrl({ ...application, year: accreditationYear })}${
            isExporter ? '/exporter' : ''
          }${START_NEW_SEGMENT}`
        : null,
    // RA102-2i2: only a 'failed' notificationStatus is surfaced — null (not yet
    // submitted, or no linked work item) and 'sent' both render nothing extra.
    notificationFailedBanner: application.notificationStatus === 'failed',
    displayReapplyAccreditationText: !REAPPLY_TEXT_HIDDEN_STATUSES.has(
      application.applicationStatus
    )
  }
}

// RA-421: the stub chooser at /operator only exists on this frontend's own
// stub auth, so it's only a valid "return" target when stub auth is active
// (or on a local env, which never has a real Re-Ex frontend to link to even
// if AUTH_STUB_ENABLED has been overridden false for testing). Otherwise the
// operator must land back on the real Re-Ex frontend's registration page —
// same organisationId/registrationId as this accreditation URL, just under
// Re-Ex's own /organisations/<id>/registrations/<id> path shape.
const STUB_RETURN_LINK = '/operator/'

function reExBackLinkUrl(organisationId, registrationId) {
  const useStub =
    config.get('auth.stubEnabled') || config.get('environment') === 'local'
  if (useStub) {
    return STUB_RETURN_LINK
  }
  return `${config.get('reex.frontendBaseUrl')}/organisations/${organisationId}/registrations/${registrationId}`
}

export const operatorAccreditationController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const { organisationId, registrationId, materialType, year } =
      request.params
    const yearInt = parseInt(year, 10)
    const userName = user?.name
    const reExBackLink = reExBackLinkUrl(organisationId, registrationId)
    const backLinkText = t('pages.operatorAccreditation.reExBackLink')

    const canAccess = await operatorCanAccessOrganisation(
      user,
      organisationId,
      {
        logger: request.logger
      }
    )
    if (!canAccess) {
      throw Boom.forbidden('You do not have access to this organisation')
    }

    const errorView = (message) =>
      h
        .view('operator-accreditation/index', {
          pageTitle: t('pages.operatorAccreditation.seedErrorHeading'),
          heading: t('pages.operatorAccreditation.seedErrorHeading'),
          userName,
          backLink: '#',
          backLinkText,
          error: message
        })
        .code(500)

    const { application, failed } = await resolveLandingApplication({
      organisationId,
      registrationId,
      materialType,
      yearInt,
      // This GET only ever lazily seeds an empty year, which is idempotent. A
      // restart is never triggered from here — see handleStartNew below.
      startNewRequested: false,
      logger: request.server.logger
    })

    if (failed) {
      return errorView(t('pages.operatorAccreditation.seedError'))
    }

    const organisationName = application.organisationName
    const siteAddress = application.siteAddress

    request.yar.set(
      ACCREDITATION_SESSION_KEYS.accreditationId,
      application.applicationId
    )
    request.yar.set(ACCREDITATION_SESSION_KEYS.organisationId, organisationId)
    request.yar.set(ACCREDITATION_SESSION_KEYS.materialType, materialType)
    request.yar.set(ACCREDITATION_SESSION_KEYS.registrationId, registrationId)
    request.yar.set(ACCREDITATION_SESSION_KEYS.year, yearInt)

    const viewModel = buildLandingViewModel(
      application,
      organisationName,
      siteAddress,
      yearInt,
      t,
      application.isExporter
    )

    const notification = request.yar.flash('notification')[0] ?? null

    request.app = request.app ?? {}
    request.app.applicationHeader = buildApplicationHeaderViewModel(
      application,
      t
    )

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      backLink: reExBackLink,
      backLinkText,
      isExporter: application.isExporter,
      notification,
      ...viewModel
    })
  }
}

// RA-357: restarting after a withdrawal. This is a POST, not a flag on the
// landing GET, for two reasons:
//   - CSRF. It creates an application, so it must carry a crumb token. @hapi/crumb
//     validates POST/PUT/PATCH/DELETE only, so a GET mutation would be the one
//     unprotected write in the accreditation journey — reachable by a crafted
//     link, since the session cookie is SameSite=Lax and rides top-level
//     navigation.
//   - Replay. Post/redirect/get keeps the mutating URL out of history and
//     bookmarks. A GET flag would re-fire on every back-button, restored tab or
//     prefetch that landed on it while only withdrawn records existed.
// It redirects to the clean landing URL, which then renders the seeded
// application through the ordinary GET path.
async function handleStartNew(request, h, { isExporter, kind }) {
  const { t } = getLocaleAndTranslator(request)
  const user = getUser(request)
  const { organisationId, registrationId, materialType, year } = request.params
  const yearInt = parseInt(year, 10)

  const canAccess = await operatorCanAccessOrganisation(user, organisationId, {
    logger: request.logger
  })
  if (!canAccess) {
    throw Boom.forbidden('You do not have access to this organisation')
  }

  const { application, failed } = await resolveLandingApplication({
    organisationId,
    registrationId,
    materialType,
    yearInt,
    startNewRequested: true,
    logger: request.server.logger,
    kind
  })

  if (failed) {
    return h
      .view('operator-accreditation/index', {
        pageTitle: t('pages.operatorAccreditation.seedErrorHeading'),
        heading: t('pages.operatorAccreditation.seedErrorHeading'),
        userName: user?.name,
        backLink: '#',
        backLinkText: t('pages.operatorAccreditation.reExBackLink'),
        error: t('pages.operatorAccreditation.seedError')
      })
      .code(500)
  }

  return h.redirect(
    landingUrl(
      { ...application, organisationId, registrationId, year: yearInt },
      isExporter
    )
  )
}

export const startNewAccreditationController = {
  handler(request, h) {
    return handleStartNew(request, h, { isExporter: false, kind: '' })
  }
}

export const startNewAccreditationExporterController = {
  handler(request, h) {
    return handleStartNew(request, h, { isExporter: true, kind: 'exporter' })
  }
}
