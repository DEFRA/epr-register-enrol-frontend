import Boom from '@hapi/boom'
import { apiClient } from '../../api-client.js'

export function provideUploadStatusFromSession(sessionKey) {
  return {
    method: async (request) => {
      const session = request.yar.get(sessionKey)
      if (!session?.statusUrl) {
        throw Boom.badRequest('No status URL found in session')
      }
      try {
        const statusPath = new URL(session.statusUrl).pathname
        return await apiClient.get(statusPath)
      } catch (err) {
        if (err.isBoom) throw err
        throw Boom.badGateway('CDP uploader status check failed')
      }
    },
    assign: 'uploadStatus'
  }
}
