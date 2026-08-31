import { accreditationApiService } from './accreditationApiService.js'
import { logStructuredError } from './logging/log-structured-error.js'

/**
 * Fetches the accreditation application, or logs the failure and builds an
 * error response via the caller's `renderErrorResponse` callback. Collapses
 * the identical try/getApplication/catch/logStructuredError shape that was
 * duplicated near-verbatim across ~20 controllers (SonarCloud duplication).
 * Only the error response itself varies per page, so that's the one thing
 * left to the caller.
 */
export async function fetchApplicationOrRenderError({
  request,
  organisationId,
  applicationId,
  errorMessage = `Error fetching application ${applicationId}`,
  renderErrorResponse
}) {
  try {
    const application = await accreditationApiService.getApplication(
      organisationId,
      applicationId
    )
    return { application }
  } catch (err) {
    logStructuredError(
      request.server.logger,
      err,
      { applicationId },
      errorMessage
    )
    return { errorResponse: renderErrorResponse() }
  }
}
