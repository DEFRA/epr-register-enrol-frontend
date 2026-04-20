import { config } from '../../../../config/config.js'

const validate = (username, password) =>
  username === config.get('auth.basicUsr') &&
  password === config.get('auth.basicPasswd')

export const basicAuthPlugin = {
  plugin: {
    name: 'basicAuth',
    async register(server) {
      if (!config.get('auth.basicEnabled')) {
        return
      }

      server.ext('onPreAuth', async (request, h) => {
        const authHeader = request.headers.authorization
        if (!authHeader?.startsWith('Basic ')) {
          return h
            .response()
            .code(401)
            .header('WWW-Authenticate', 'Basic realm="Application"')
            .takeover()
        }

        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
        const colonIndex = decoded.indexOf(':')
        const username = decoded.slice(0, colonIndex)
        const password = decoded.slice(colonIndex + 1)

        const isValid = validate(username, password)
        if (!isValid) {
          return h
            .response()
            .code(401)
            .header('WWW-Authenticate', 'Basic realm="Application"')
            .takeover()
        }

        return h.continue
      })
    }
  }
}
