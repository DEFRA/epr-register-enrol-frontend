import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { accreditationApiService } from '../common/helpers/accreditationApiService.js'
import { ACCREDITATION_SESSION_KEYS } from '../common/constants/accreditationSessionKeys.js'

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
    registrationReference: application.RegistrationReference,
    siteName: siteAddress ?? t('pages.taskList.siteNotSet'),
    materialDisplay: t(
      `pages.operatorAccreditation.materials.${application.materialType}`
    ),
    statusLabel: t(
      `pages.operatorAccreditation.statuses.${application.applicationStatus}`
    ),
    statusTagClass: config.tagClass,
    taskListUrl: `/accreditation/task-list/${application.applicationId}`
  }
}

export const operatorAccreditationController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const { organisationId, siteId, materialType, year } = request.params
    const yearInt = parseInt(year, 10)
    const userName = user?.name
    const reExBackLink = '/operator/'

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
        app.siteId === siteId &&
        app.materialType === materialType &&
        app.year === yearInt
    )

    if (!application) {
      try {
        application = await accreditationApiService.seedApplication(
          organisationId,
          siteId,
          materialType,
          yearInt
        )
      } catch (error) {
        request.server.logger.error(
          `Error seeding accreditation application: ${error.message}`
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
    request.yar.set(ACCREDITATION_SESSION_KEYS.siteId, siteId)
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
