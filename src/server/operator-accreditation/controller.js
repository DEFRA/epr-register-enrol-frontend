import Boom from '@hapi/boom'

import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { operatorCanAccessOrganisation } from '../common/helpers/reex-organisation-service.js'
import { accreditationApiService } from '../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../common/constants/accreditationSessionKeys.js'
import { buildMaterialDisplay } from '../common/helpers/material-display.js'

const STATUS_CONFIG = {
  Saved: { tagClass: 'govuk-tag--grey' },
  Started: { tagClass: 'govuk-tag--blue' },
  NotStarted: { tagClass: 'govuk-tag--grey' },
  InProgress: { tagClass: 'govuk-tag--blue' },
  Sent: { tagClass: 'govuk-tag--turquoise' },
  Approved: { tagClass: 'govuk-tag--green' },
  Rejected: { tagClass: 'govuk-tag--red' }
}

export function buildLandingViewModel(
  application,
  organisationName,
  siteAddress,
  accreditationYear,
  t
) {
  const config = STATUS_CONFIG[application.applicationStatus] ?? {
    tagClass: ''
  }
  return {
    organisationName,
    accreditationYear,
    registrationId:
      application.registrationId ?? application.applicationReference,
    siteName: siteAddress ?? t('pages.taskList.siteNotSet'),
    materialDisplay: buildMaterialDisplay(
      application.materialType,
      application.glassRecyclingProcess,
      t
    ),
    statusLabel: t(
      `pages.operatorAccreditation.statuses.${application.applicationStatus}`
    ),
    statusTagClass: config.tagClass,
    taskListUrl: `/accreditation/task-list/${application.applicationId}`,
    // RA102-2i2: only a 'failed' notificationStatus is surfaced — null (not yet
    // submitted, or no linked work item) and 'sent' both render nothing extra.
    notificationFailedBanner: application.notificationStatus === 'failed'
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

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      reExBackUrl: reExBackLink,
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
      t
    )

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      reExBackUrl: reExBackLink,
      isExporter: true,
      ...viewModel
    })
  }
}
