import { config } from '../../../../config/config.js'

const users = {
  test: {
    username: 'test',
    password: 'test123',
    name: 'BasicAuthUser',
    id: 'Basic'
  }
}

const validate = async (username, password) => {
  const user = users[username]
  if (!user) {
    return false
  }
  return password === user.password
}

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

        const isValid = await validate(username, password)
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
