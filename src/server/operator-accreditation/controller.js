import Boom from '@hapi/boom'

import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { accreditationApiService } from '../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../common/constants/accreditationSessionKeys.js'
import {
  queryTaskListUrl,
  landingUrl
} from '../common/helpers/accreditationUrls.js'
import { materialDisplayName } from '../common/helpers/materialDisplayName.js'
import { buildApplicationHeaderViewModel } from '../common/helpers/applicationHeader.js'

const WITHDRAWN_STATUS = 'Withdrawn'

// RA-357: "Start new accreditation application" re-enters the SAME landing
// route, so a plain visit to a withdrawn application must not be confused with
// an explicit request to start again — otherwise merely being redirected back
// here after withdrawing would silently create a replacement application.
const START_NEW_PARAM = 'startNew'

const STATUS_CONFIG = {
  Saved: { tagClass: 'govuk-tag--grey' },
  Started: { tagClass: 'govuk-tag--blue' },
  NotStarted: { tagClass: 'govuk-tag--grey' },
  InProgress: { tagClass: 'govuk-tag--blue' },
  Submitted: { tagClass: 'govuk-tag--green' },
  DulyMade: { tagClass: 'govuk-tag--turquoise' },
  Queried: { tagClass: 'govuk-tag--orange' },
  Updated: { tagClass: 'govuk-tag--turquoise' },
  Approved: { tagClass: 'govuk-tag--green' },
  Rejected: { tagClass: 'govuk-tag--red' },
  Withdrawn: { tagClass: 'govuk-tag--grey' }
}

// An application can only be withdrawn before a final regulator decision —
// shared with withdraw-application/controller.js so the two routes can never
// disagree about which statuses are withdrawable.
export const NON_WITHDRAWABLE_STATUSES = new Set([
  //Not submitted tso can't be withdrawn
  'Saved',
  'Started',
  'NotStarted',
  // Final decisions made can't be withdrawn
  'Approved',
  'Refused',
  'Cancelled',
  'Rejected',
  // Withdrawn is a final state, so can't be withdrawn again
  'Withdrawn'
])

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

// The prior accreditation year always runs to 31 December, with the
// reapplication due 30 September of that same prior year.
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
    dueDate: `30 September ${priorYear}`,
    currentAccreditation: buildCurrentAccreditation(
      application,
      siteName,
      priorYear
    ),
    taskListUrl:
      application.applicationStatus === 'Queried'
        ? queryTaskListUrl(application.applicationId)
        : `/accreditation/task-list/${application.applicationId}`,
    showContinueLink: application.applicationStatus !== WITHDRAWN_STATUS,
    canWithdraw: !NON_WITHDRAWABLE_STATUSES.has(application.applicationStatus),
    withdrawUrl: `/accreditation/withdraw-application/${application.applicationId}`,
    // RA-357: starting again after a withdrawal creates a new application for
    // the SAME accreditation year — the withdrawn record is kept untouched for
    // audit. This used to link to accreditationYear + 1, which seeded against a
    // prior year that has no approved accreditation and always failed.
    startNewUrl:
      application.applicationStatus === WITHDRAWN_STATUS
        ? `${landingUrl(
            { ...application, year: accreditationYear },
            isExporter
          )}?${START_NEW_PARAM}=true`
        : null,
    // RA102-2i2: only a 'failed' notificationStatus is surfaced — null (not yet
    // submitted, or no linked work item) and 'sent' both render nothing extra.
    notificationFailedBanner: application.notificationStatus === 'failed',
    displayReapplyAccreditationText: !REAPPLY_TEXT_HIDDEN_STATUSES.has(
      application.applicationStatus
    )
  }
}

// The backend gives no ordering guarantee on GET /{organisationId} (confirmed
// with the backend team for RA-357 — the Mongo find is unsorted), so array
// order must never decide which record wins. Sort explicitly on createdAt,
// newest first, with applicationId as a stable secondary tiebreak — the same
// rule the seed endpoint now applies server-side.
function createdAtTime(application) {
  const parsed = Date.parse(application.createdAt)
  return Number.isNaN(parsed) ? -Infinity : parsed
}

function latest(applications) {
  return applications.reduce((best, application) => {
    if (best === null) return application
    const difference = createdAtTime(application) - createdAtTime(best)
    if (difference > 0) return application
    if (difference < 0) return best
    return String(application.applicationId) > String(best.applicationId)
      ? application
      : best
  }, null)
}

// RA-357: a single accreditation year can now hold both a withdrawn record and
// its live replacement, so pick the newest live application and only fall back
// to a withdrawn one when that is genuinely all there is for the year.
export function selectApplicationForYear(
  applications,
  { registrationId, materialType, year }
) {
  const matching = applications.filter(
    (app) =>
      app.registrationId === registrationId &&
      app.materialType === materialType &&
      app.year === year
  )
  const live = matching.filter(
    (app) => app.applicationStatus !== WITHDRAWN_STATUS
  )

  return {
    application: latest(live) ?? latest(matching),
    hasLive: live.length > 0,
    hasMatch: matching.length > 0
  }
}

// Shared by the reprocessor and exporter landing controllers so the two routes
// can never disagree about which application is rendered or when a new one is
// seeded. Returns { application: null, failed: true } when the caller should
// render the seed-error view.
export async function resolveLandingApplication({
  organisationId,
  registrationId,
  materialType,
  yearInt,
  startNewRequested,
  logger,
  logLabel = ''
}) {
  let applications
  try {
    applications =
      await accreditationApiService.listApplications(organisationId)
  } catch (error) {
    logger.error(`Error fetching accreditation applications: ${error.message}`)
    return { application: null, failed: true }
  }

  const { application, hasLive, hasMatch } = selectApplicationForYear(
    applications,
    { registrationId, materialType, year: yearInt }
  )

  // Seed when the year is empty, or when every record for it is withdrawn and
  // the operator explicitly asked to start again. Simply viewing a withdrawn
  // application must leave it exactly as it is.
  if (hasMatch && (hasLive || !startNewRequested)) {
    return { application, failed: false }
  }

  try {
    return {
      application: await accreditationApiService.seedApplication(
        organisationId,
        registrationId,
        materialType,
        yearInt
      ),
      failed: false
    }
  } catch (error) {
    logger.error(
      `Error seeding ${logLabel}accreditation application for org=${organisationId} registration=${registrationId} material=${materialType} year=${yearInt}: ${error.message} status=${error.status} response=${error.response}`
    )
    return { application: null, failed: true }
  }
}

export const operatorAccreditationController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const { organisationId, registrationId, materialType, year } =
      request.params
    const yearInt = parseInt(year, 10)
    const userName = user?.name
    const reExBackLink = '/operator/'
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
      startNewRequested: request.query[START_NEW_PARAM] === 'true',
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
      t
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
      notification,
      ...viewModel
    })
  }
}

export const operatorAccreditationExporterController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const { organisationId, registrationId, materialType, year } =
      request.params
    const yearInt = parseInt(year, 10)
    const userName = user?.name
    const reExBackLink = '/operator/'
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
      startNewRequested: request.query[START_NEW_PARAM] === 'true',
      logger: request.server.logger,
      logLabel: 'exporter '
    })

    if (failed) {
      return errorView(t('pages.operatorAccreditation.seedError'))
    }

    const organisationName = application.organisationName

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
      null,
      yearInt,
      t,
      true
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
      isExporter: true,
      notification,
      ...viewModel
    })
  }
}
