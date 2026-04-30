import { getLocaleAndTranslator } from '../common/helpers/get-locale-translator.js'
import { getUser } from '../common/helpers/auth/get-user.js'
import { apiClient } from '../common/api-client.js'

const STATUS_CONFIG = {
  Saved: { tagClass: 'govuk-tag--grey', isEditable: true },
  Started: { tagClass: 'govuk-tag--blue', isEditable: true },
  Sent: { tagClass: 'govuk-tag--turquoise', isEditable: false },
  Approved: { tagClass: 'govuk-tag--green', isEditable: false },
  Rejected: { tagClass: 'govuk-tag--red', isEditable: false }
}

export function buildApplicationViewModel(application, t) {
  const config = STATUS_CONFIG[application.ApplicationStatus] ?? {
    tagClass: '',
    isEditable: false
  }
  const formattedDateSent = application.DateSent
    ? new Date(application.DateSent).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : null

  return {
    applicationId: application.ApplicationId,
    materialType: application.MaterialType,
    materialDisplay: t(
      `pages.operatorAccreditation.materials.${application.MaterialType}`
    ),
    statusLabel: t(
      `pages.operatorAccreditation.statuses.${application.ApplicationStatus}`
    ),
    statusTagClass: config.tagClass,
    isEditable: config.isEditable,
    applicationReference: application.ApplicationReference,
    dateSent: formattedDateSent,
    submittedBy: application.SubmittedBy?.FullName ?? null,
    taskListUrl: `/accreditation/task-list/${application.ApplicationId}`
  }
}

export const operatorAccreditationController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id

    let rawApplications = []
    let apiError = false

    try {
      rawApplications = await apiClient.get(
        `/api/v1/accreditation-applications/${organisationId}`
      )
    } catch (error) {
      request.server.logger.error(
        `Error fetching accreditation applications: ${error.message}`
      )
      apiError = true
    }

    if (apiError) {
      return h.view('operator-accreditation/index', {
        pageTitle: t('pages.operatorAccreditation.title'),
        heading: t('pages.operatorAccreditation.heading'),
        applications: [],
        hasApplications: false,
        hasSubmittedApplications: false,
        error: t('pages.operatorAccreditation.errorLoading')
      })
    }

    const applications = rawApplications.map((app) =>
      buildApplicationViewModel(app, t)
    )

    const hasSubmittedApplications = rawApplications.some((app) =>
      ['Sent', 'Approved', 'Rejected'].includes(app.ApplicationStatus)
    )

    return h.view('operator-accreditation/index', {
      pageTitle: t('pages.operatorAccreditation.title'),
      heading: t('pages.operatorAccreditation.heading'),
      applications,
      hasApplications: applications.length > 0,
      hasSubmittedApplications
    })
  }
}
