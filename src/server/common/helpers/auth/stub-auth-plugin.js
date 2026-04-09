import cookie from '@hapi/cookie'

import { config } from '../../../../config/config.js'

export const TEST_REGULATOR = {
  id: 'test-regulator-id',
  email: 'regulator@test.example',
  name: 'Test Regulator',
  userType: 'regulator',
  scope: ['regulator']
}

export const TEST_OPERATOR = {
  id: 'test-operator-id',
  email: 'operator@test.example',
  name: 'Test Operator',
  userType: 'operator',
  scope: ['operator']
}

// Default test user — kept for backwards compatibility
export const TEST_USER = TEST_REGULATOR

const TEST_USERS = { regulator: TEST_REGULATOR, operator: TEST_OPERATOR }

export const stubAuthPlugin = {
  plugin: {
    name: 'auth',
    async register(server) {
      if (config.get('isTest')) {
        // Test mode: bypass scheme — always authenticated.
        // Tests can override the user type by setting the x-test-user-type header
        // (e.g. 'regulator' or 'operator'). Defaults to regulator.
        server.auth.scheme('test-bypass', () => ({
          authenticate(request, h) {
            const userType = request.headers['x-test-user-type'] ?? 'regulator'
            const user = TEST_USERS[userType] ?? TEST_REGULATOR
            return h.authenticated({ credentials: user })
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
            return { valid: true, credentials: { ...user, scope: [user.userType] } }
          }
        })
        server.auth.default('session')
      }
    }
  }
}
