import Boom from '@hapi/boom'

import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { accreditationApiService } from '../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../common/constants/accreditationSessionKeys.js'
import { queryTaskListUrl } from '../common/helpers/accreditationUrls.js'

const STATUS_CONFIG = {
  Saved: { tagClass: 'govuk-tag--grey' },
  Started: { tagClass: 'govuk-tag--blue' },
  NotStarted: { tagClass: 'govuk-tag--grey' },
  InProgress: { tagClass: 'govuk-tag--blue' },
  Submitted: { tagClass: 'govuk-tag--green' },
  Queried: { tagClass: 'govuk-tag--orange' },
  Updated: { tagClass: 'govuk-tag--turquoise' },
  Approved: { tagClass: 'govuk-tag--green' },
  Rejected: { tagClass: 'govuk-tag--red' }
}

const GLASS_RECYCLING_PROCESS_KEYS = {
  glass_re_melt: 'pages.materialSelection.glassRemelt',
  glass_other: 'pages.materialSelection.glassOther'
}

// The reapply prompt only makes sense while an application is still live —
// once it's been decided (approved/refused) or dropped (withdrawn/cancelled)
// there's nothing left to reapply for.
const REAPPLY_TEXT_HIDDEN_STATUSES = new Set([
  'Approved',
  'Withdrawn',
  'Cancelled',
  'Refused',
  'Rejected'
])

function materialDisplayName(application, t) {
  const { materialType, glassRecyclingProcess } = application
  if (!materialType) return ''

  const glassKey = GLASS_RECYCLING_PROCESS_KEYS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassKey) return t(glassKey)

  return t(`pages.materialSelection.materials.${materialType}`)
}

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
    pageHeading: `${siteName} : reapplication for ${matDisp} accreditation for ${accreditationYear}`,
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
    // RA102-2i2: only a 'failed' notificationStatus is surfaced — null (not yet
    // submitted, or no linked work item) and 'sent' both render nothing extra.
    notificationFailedBanner: application.notificationStatus === 'failed',
    displayReapplyAccreditationText: !REAPPLY_TEXT_HIDDEN_STATUSES.has(
      application.applicationStatus
    )
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
          reExBackUrl: '#',
          error: message
        })
        .code(500)

    let applications
    try {
      applications =
        await accreditationApiService.listApplications(organisationId)
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation applications: ${error.message}`
      )
      return errorView(t('pages.operatorAccreditation.seedError'))
    }

    let application = applications.find(
      (app) =>
        app.registrationId === registrationId &&
        app.materialType === materialType &&
        app.year === yearInt
    )

    if (!application) {
      try {
        application = await accreditationApiService.seedApplication(
          organisationId,
          registrationId,
          materialType,
          yearInt
        )
      } catch (error) {
        request.server.logger.error(
          `Error seeding accreditation application for org=${organisationId} registration=${registrationId} material=${materialType} year=${yearInt}: ${error.message} status=${error.status} response=${error.response}`
        )
        return errorView(t('pages.operatorAccreditation.seedError'))
      }
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

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      reExBackUrl: reExBackLink,
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
          reExBackUrl: '#',
          error: message
        })
        .code(500)

    let applications
    try {
      applications =
        await accreditationApiService.listApplications(organisationId)
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation applications: ${error.message}`
      )
      return errorView(t('pages.operatorAccreditation.seedError'))
    }

    let application = applications.find(
      (app) =>
        app.registrationId === registrationId &&
        app.materialType === materialType &&
        app.year === yearInt
    )

    if (!application) {
      try {
        application = await accreditationApiService.seedApplication(
          organisationId,
          registrationId,
          materialType,
          yearInt
        )
      } catch (error) {
        request.server.logger.error(
          `Error seeding exporter accreditation application for org=${organisationId} registration=${registrationId} material=${materialType} year=${yearInt}: ${error.message} status=${error.status} response=${error.response}`
        )
        return errorView(t('pages.operatorAccreditation.seedError'))
      }
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

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      reExBackUrl: reExBackLink,
      isExporter: true,
      notification,
      ...viewModel
    })
  }
}
