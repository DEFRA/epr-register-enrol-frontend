import { accreditationChangesService } from '../../common/helpers/accreditationChangesService.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'

/**
 * RA-697: change requests are read only for the current-year accreditation
 * that loadManagePage resolves, so a previous year's unapplied requests, kept
 * against that year's accreditation, drop off the pages at year end. For a
 * registration-only context they are the registration's own, which the
 * backend reads for the current year.
 *
 * Returns null, having logged why, when they cannot be read; each page
 * decides what that means for it.
 *
 * @param {object} context - loadManagePage's context
 */
export async function fetchChangeRequestsView(request, context) {
  const { organisationId, registrationId, materialType } = request.params
  try {
    return context.isRegistrationOnly
      ? await accreditationChangesService.getRegistrationView(
          organisationId,
          registrationId,
          materialType
        )
      : await accreditationChangesService.getView(
          organisationId,
          context.application.applicationId
        )
  } catch (error) {
    logStructuredError(
      request.logger,
      error,
      {
        organisationId,
        registrationId,
        applicationId: context.application?.applicationId ?? null
      },
      'Error fetching the accreditation change requests'
    )
    return null
  }
}
