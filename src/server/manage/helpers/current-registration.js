import { getRegistrationStatus } from '../../common/helpers/registrationApiService.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { APPROVED_STATUS } from './constants.js'

/**
 * The registration, provided it is Approved. Shared by every RA-425 page
 * alongside fetchCurrentAccreditation: none of them may show an accreditation
 * view for a registration that isn't in good standing.
 *
 * Returns null when the status is Created, Rejected or Cancelled, when the
 * registration has no record, or when the call fails; the caller shows the
 * service-problem page.
 */
export async function fetchApprovedRegistration({ registrationId, logger }) {
  try {
    const registration = await getRegistrationStatus(registrationId)
    if (registration?.status !== APPROVED_STATUS) {
      logger.warn(
        { registrationId, registrationStatus: registration?.status },
        'Registration is not Approved'
      )
      return null
    }
    return registration
  } catch (error) {
    logStructuredError(
      logger,
      error,
      { registrationId },
      'Error fetching the registration status'
    )
    return null
  }
}
