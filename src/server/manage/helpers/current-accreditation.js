import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { latestByCreatedAt } from '../../common/helpers/accreditationSelection.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { APPROVED_STATUS } from '../../common/constants/applicationStatuses.js'
import { currentYear } from '../../common/helpers/currentYear.js'

function selectCurrentAccreditation(
  applications,
  { registrationId, materialType, year }
) {
  return latestByCreatedAt(
    applications.filter(
      (application) =>
        application.registrationId === registrationId &&
        application.materialType === materialType &&
        application.year === year &&
        application.applicationStatus === APPROVED_STATUS
    )
  )
}

/**
 * Shared by every RA-425 page so they always agree on which accreditation they
 * show.
 *
 * RA-697: "none found" and "call failed" differ. Returns { application } when
 * the lookup succeeds, with application null when nothing matches (a
 * registration-only operator), and { failed: true } when any API call fails;
 * the caller then shows the service-problem page rather than partial
 * information, so an outage never passes for "no accreditation".
 *
 * @returns {Promise<{ application: object | null } | { failed: true }>}
 */
export async function fetchCurrentAccreditation({
  organisationId,
  registrationId,
  materialType,
  logger
}) {
  try {
    const applications =
      await accreditationApiService.listApplications(organisationId)
    // RA-425: the compliance period is always the current calendar year,
    // never a URL parameter.
    const chosen = selectCurrentAccreditation(applications, {
      registrationId,
      materialType,
      year: currentYear()
    })
    if (!chosen) {
      logger.info(
        { organisationId, registrationId, materialType },
        'No Approved current-year accreditation application found'
      )
      return { application: null }
    }
    return {
      application: await accreditationApiService.getApplication(
        organisationId,
        chosen.applicationId
      )
    }
  } catch (error) {
    logStructuredError(
      logger,
      error,
      { organisationId, registrationId, materialType },
      'Error fetching the current accreditation application'
    )
    return { failed: true }
  }
}
