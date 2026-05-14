import Boom from '@hapi/boom'

export function provideUploadStatusFromSession(sessionKey) {
  return {
    method: async (request) => {
      const session = request.yar.get(sessionKey)
      if (!session?.statusUrl) {
        throw Boom.badRequest('No status URL found in session')
      }
      const response = await fetch(session.statusUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        throw Boom.badGateway('CDP uploader status check failed')
      }
      return await response.json()
    },
    assign: 'uploadStatus'
  }
}
