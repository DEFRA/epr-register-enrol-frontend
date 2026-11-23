import Boom from '@hapi/boom'

import { statusCodes } from '../../common/constants/status-codes.js'
import { getRegistrationStatusByNumber } from '../../common/helpers/registrationApiService.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { APPROVED_STATUS } from '../../common/constants/applicationStatuses.js'

/**
 * RA-739: the /manage URLs carry the registration number, so the registration
 * is found by it before anything else, and its ReEx registration id is what
 * the accreditation and change-request lookups use.
 *
 * A 404 from the backend means no current registration has the number, or
 * that organisation number's organisation doesn't hold it, so the page is a
 * 404 too. Returns null when the call fails any other way; the caller shows
 * the service-problem page.
 */
export async function fetchRegistration({
  organisationId,
  registrationNumber,
  logger
}) {
  try {
    return await getRegistrationStatusByNumber(
      registrationNumber,
      organisationId
    )
  } catch (error) {
    if (error.status === statusCodes.notFound) {
      throw Boom.notFound()
    }
    logStructuredError(
      logger,
      error,
      { registrationNumber },
      'Error fetching the registration status'
    )
    return null
  }
}

/**
 * No RA-425 page may show an accreditation view for a registration that isn't
 * in good standing: Created, Rejected or Cancelled.
 */
export function isApprovedRegistration(registration, logger) {
  if (registration.status === APPROVED_STATUS) {
    return true
  }
  logger.warn(
    {
      registrationId: registration.registrationId,
      registrationStatus: registration.status
    },
    'Registration is not Approved'
  )
  return false
}
