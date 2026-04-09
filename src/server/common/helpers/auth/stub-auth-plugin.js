import Boom from '@hapi/boom'

import { config } from '../../../../config/config.js'
import { redirectToLogin } from './auth-redirect.js'

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
        server.ext('onPreResponse', redirectToLogin)
      } else {
        // Stub mode (local/dev): yar-session scheme + stub chooser
        server.auth.scheme('yar-session', () => ({
          authenticate(request, h) {
            const user = request.yar.get('user')
            if (!user) {
              return h.unauthenticated(Boom.unauthorized(null, 'session'))
            }
            return h.authenticated({ credentials: { ...user, scope: [user.userType] } })
          }
        }))
        server.auth.strategy('session', 'yar-session')
        server.auth.default('session')
        server.ext('onPreResponse', redirectToLogin)
      }
    }
  }
}
