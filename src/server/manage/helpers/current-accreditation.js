import { accreditationApiService } from '../../common/helpers/accreditationApiService.js'
import { latestByCreatedAt } from '../../common/helpers/accreditationSelection.js'
import { logStructuredError } from '../../common/helpers/logging/log-structured-error.js'
import { APPROVED_STATUS } from '../../common/constants/applicationStatuses.js'
import { currentYear } from '../../common/helpers/currentYear.js'
import { matchesUrlMaterial } from './url-material.js'

function selectCurrentAccreditation(registrationApplications, year) {
  return latestByCreatedAt(
    registrationApplications.filter(
      (application) =>
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
 * RA-765: registrationApplications is every year's application for the
 * registration and the URL's material, so a page can work out which year the
 * operator may apply for without another call.
 *
 * @param {object} params
 * @param {{ materialType: string, glassRecyclingProcess: string|null }} params.urlMaterial
 *   the URL's material, from parseUrlMaterial
 * @returns {Promise<{ application: object | null, registrationApplications: object[] } | { failed: true }>}
 */
export async function fetchCurrentAccreditation({
  organisationId,
  registrationId,
  urlMaterial,
  logger
}) {
  try {
    const registrationApplications = (
      await accreditationApiService.listApplications(organisationId)
    ).filter(
      (application) =>
        application.registrationId === registrationId &&
        matchesUrlMaterial(application, urlMaterial)
    )
    // RA-425: the compliance period is always the current calendar year,
    // never a URL parameter.
    const chosen = selectCurrentAccreditation(
      registrationApplications,
      currentYear()
    )
    if (!chosen) {
      logger.info(
        { organisationId, registrationId, ...urlMaterial },
        'No Approved current-year accreditation application found'
      )
      return { application: null, registrationApplications }
    }
    return {
      application: await accreditationApiService.getApplication(
        organisationId,
        chosen.applicationId
      ),
      registrationApplications
    }
  } catch (error) {
    logStructuredError(
      logger,
      error,
      { organisationId, registrationId, ...urlMaterial },
      'Error fetching the current accreditation application'
    )
    return { failed: true }
  }
}
