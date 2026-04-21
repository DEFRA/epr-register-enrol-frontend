import { config } from '../../../../config/config.js'

export const basicAuthPlugin = {
  plugin: {
    name: 'basicAuth',
    async register(server) {
      if (!config.get('auth.basicEnabled')) {
        return
      }

      const validUsername = config.get('auth.basicUsr')
      const validPassword = config.get('auth.basicPasswd')

      if (!validUsername || !validPassword) {
        throw new Error(
          'Basic auth enabled but username or password not set in config'
        )
      }

      server.ext('onPreAuth', async (request, h) => {
        if (request.path === '/health') {
          return h.continue
        }

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

        const isValid = username === validUsername && password === validPassword
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
