import Boom from '@hapi/boom'
import { apiClient } from '../../api-client.js'
import { statusCodes } from '../../constants/status-codes.js'
import { getLocaleAndTranslator } from '../get-locale-translator.js'
import { localePrefix } from '../localePrefix.js'
import { logStructuredError } from '../logging/log-structured-error.js'

/**
 * Route pre-handler for an upload status page: looks up the upload this
 * session started and assigns the backend's status to request.pre.uploadStatus.
 *
 * The backend answers 404 when it has no record of the upload (it expired,
 * or it never started there), so the upload will never become ready. Rather
 * than the status page polling forever, the operator gets the
 * upload-not-found page, which does not refresh, with a link to upload again
 * (under /cy when the status page was, so a Welsh user stays in Welsh).
 * Both that and any other failure (a 502) are logged at error level with the
 * session key and status path, so an upload the operator lost leaves a trace.
 * The session entry is left in place: only the status route reads it, so a
 * refresh shows this page again, and the next upload replaces it.
 *
 * @param {string} sessionKey - yar key holding the upload's statusUrl
 * @param {(params: Object) => string} uploadPageUrl - the journey's upload
 *   page for the route's params, linked as the way to upload again
 */
export function provideUploadStatusFromSession(sessionKey, uploadPageUrl) {
  return {
    method: async (request, h) => {
      const session = request.yar.get(sessionKey)
      if (!session?.statusUrl) {
        throw Boom.badRequest('No status URL found in session')
      }
      let statusPath
      try {
        statusPath = new URL(session.statusUrl).pathname
        return await apiClient.get(statusPath)
      } catch (err) {
        const context = { sessionKey, statusPath }
        if (err.status === statusCodes.notFound) {
          logStructuredError(
            request.logger,
            err,
            context,
            'Upload status not found: the backend has no record of this upload'
          )
          const { currentLocale, t } = getLocaleAndTranslator(request)
          return h
            .view('errors/upload-not-found', {
              pageTitle: t('common.errors.uploadNotFound.title'),
              uploadPageUrl: `${localePrefix(currentLocale)}${uploadPageUrl(request.params)}`
            })
            .code(statusCodes.notFound)
            .takeover()
        }
        logStructuredError(
          request.logger,
          err,
          context,
          'Upload status check failed'
        )
        throw Boom.badGateway('CDP uploader status check failed')
      }
    },
    assign: 'uploadStatus'
  }
}
