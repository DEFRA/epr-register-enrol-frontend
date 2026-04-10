import Boom from '@hapi/boom'

import { redirectToLogin } from './auth-redirect.js'

export const authPlugin = {
  plugin: {
    name: 'auth',
    async register(server) {
      // Custom scheme: reads the authenticated user from the yar server-side session.
      // Yar is loaded in onPreAuth (before this runs), so request.yar is always available.
      server.auth.scheme('yar-session', () => ({
        authenticate(request, h) {
          const user = request.yar.get('user')
          if (!user) {
            return h.unauthenticated(Boom.unauthorized(null, 'session'))
          }
          return h.authenticated({
            credentials: { ...user, scope: [user.userType] }
          })
        }
      }))

      server.auth.strategy('session', 'yar-session')

      // Protect all routes by default; individual routes may opt out with auth: false
      server.auth.default('session')

      // Redirect unauthenticated requests to the appropriate login page.
      // Registered here so it runs before the generic catchAll error handler.
      server.ext('onPreResponse', redirectToLogin)
    }
  }
}
