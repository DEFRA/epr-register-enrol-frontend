import {
  stubSetFile,
  stubGetStatus
} from '../common/helpers/upload/stub-uploader.js'

export const stubCdp = {
  plugin: {
    name: 'stub-cdp',
    register(server) {
      server.route([
        {
          method: 'POST',
          path: '/api/stub/cdp-upload/{uploadId}',
          options: {
            auth: false,
            plugins: { crumb: { skip: true } },
            payload: { output: 'data', parse: false }
          },
          handler(request, h) {
            const { uploadId } = request.params
            const filename = request.headers['x-filename'] ?? 'unknown'
            const contentType =
              request.headers['content-type'] ?? 'application/octet-stream'
            stubSetFile(uploadId, { filename, contentType })
            return h.response({}).code(200)
          }
        },
        {
          method: 'GET',
          path: '/api/stub/cdp-status/{uploadId}',
          options: { auth: false },
          handler(request, h) {
            const { uploadId } = request.params
            return h.response(stubGetStatus(uploadId)).code(200)
          }
        }
      ])
    }
  }
}
