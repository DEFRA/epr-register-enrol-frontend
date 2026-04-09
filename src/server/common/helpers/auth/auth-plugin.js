import cookie from '@hapi/cookie'

import { config } from '../../../../config/config.js'

export const authPlugin = {
  plugin: {
    name: 'auth',
    async register(server) {
      await server.register([cookie])

      // Cookie strategy — validates the session on every protected request
      server.auth.strategy('session', 'cookie', {
        cookie: {
          name: 'auth',
          password: config.get('session.cookie.password'),
          isSecure: config.get('session.cookie.secure'),
          ttl: config.get('session.cookie.ttl')
        },
        validate: async (request, session) => {
          const user = request.yar.get('user')
          if (!user) return { valid: false }
          return { valid: true, credentials: { ...user, scope: [user.userType] } }
        }
      })

      // Protect all routes by default; individual routes may opt out with auth: false
      server.auth.default('session')
    }
  }
}
