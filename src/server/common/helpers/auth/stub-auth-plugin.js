import cookie from '@hapi/cookie'

import { config } from '../../../../config/config.js'

export const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  userType: 'regulator'
}

export const stubAuthPlugin = {
  plugin: {
    name: 'auth',
    async register(server) {
      if (config.get('isTest')) {
        // Test mode: bypass scheme — always authenticated
        server.auth.scheme('test-bypass', () => ({
          authenticate(request, h) {
            return h.authenticated({ credentials: TEST_USER })
          }
        }))
        server.auth.strategy('session', 'test-bypass')
        server.auth.default('session')
      } else {
        // Stub mode (local/dev): cookie strategy + stub chooser
        await server.register([cookie])
        server.auth.strategy('session', 'cookie', {
          cookie: {
            name: 'auth',
            password: config.get('session.cookie.password'),
            isSecure: false,
            ttl: config.get('session.cookie.ttl')
          },
          validate: async (request, session) => {
            const user = request.yar.get('user')
            if (!user) return { valid: false }
            return { valid: true, credentials: user }
          }
        })
        server.auth.default('session')
      }
    }
  }
}
