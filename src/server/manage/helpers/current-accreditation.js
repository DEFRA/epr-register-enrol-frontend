import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { latestByCreatedAt } from '../../common/helpers/accreditationSelection.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { APPROVED_STATUS } from './constants.js'

// RA-425: the compliance period is always the current calendar year, never a
// URL parameter. Read from the clock on every request so a long-running
// process rolls over at midnight on 1 January.
function currentYear() {
  return new Date().getUTCFullYear()
}

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
 * The Approved application for this registration and material in the current
 * calendar year, fetched in full. Shared by every RA-425 page so they always
 * agree on which accreditation they show.
 *
 * Returns null when nothing matches or when any API call fails; the caller
 * shows the service-problem page rather than partial information.
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
    const chosen = selectCurrentAccreditation(applications, {
      registrationId,
      materialType,
      year: currentYear()
    })
    if (!chosen) {
      logger.warn(
        { organisationId, registrationId, materialType },
        'No Approved current-year accreditation application found'
      )
      return null
    }
    return await accreditationApiService.getApplication(
      organisationId,
      chosen.applicationId
    )
  } catch (error) {
    logStructuredError(
      logger,
      error,
      { organisationId, registrationId, materialType },
      'Error fetching the current accreditation application'
    )
    return null
  }
}
