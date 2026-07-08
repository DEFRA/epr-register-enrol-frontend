import { statusCodes } from '../constants/status-codes.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    default:
      return 'Something went wrong'
  }
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  // A 503 means a dependency (e.g. the ReEx organisation lookup) is temporarily
  // unavailable — show a distinct "try again later" page, not a generic error or
  // an "access denied" that misrepresents an outage as a permissions problem.
  if (statusCode === statusCodes.serviceUnavailable) {
    return h
      .view('error/index', {
        pageTitle: 'Sorry, the service is unavailable',
        heading: 'Sorry, the service is unavailable',
        message:
          'You will be able to use the service later. Try again in a few minutes.'
      })
      .code(statusCode)
  }

  // Use custom message for Welsh translation errors, otherwise use status code message
  const errorMessage =
    response.message === 'Welsh translations not available yet'
      ? response.message
      : statusCodeMessage(statusCode)

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage
    })
    .code(statusCode)
}
