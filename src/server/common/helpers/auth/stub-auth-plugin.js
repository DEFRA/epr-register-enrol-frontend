import { config } from '../../../../config/config.js'
import { redirectToLogin } from './auth-redirect.js'
import { yarSessionAuthenticate } from './session-idle-timeout.js'

export const TEST_OPERATOR = {
  id: 'test-operator-id',
  email: 'operator@test.example',
  name: 'Test Operator',
  userType: 'operator',
  scope: ['operator'],
  // Defra ID relationship shape: `relationshipId:organisationId:organisationName`.
  currentRelationshipId: 'rel-test-operator',
  relationships: ['rel-test-operator:org-123:Test Operator Org']
}

export const stubAuthPlugin = {
  plugin: {
    name: 'auth',
    async register(server) {
      if (config.get('isTest')) {
        // Test mode: bypass scheme — always authenticated as TEST_OPERATOR,
        // the only user type this service has. Any x-test-user-type header a
        // test still sends is ignored.
        server.auth.scheme('test-bypass', () => ({
          authenticate(request, h) {
            return h.authenticated({ credentials: TEST_OPERATOR })
          }
        }))
        server.auth.strategy('session', 'test-bypass')
        server.auth.default('session')
        server.ext('onPreResponse', redirectToLogin)
      } else {
        // Stub mode (local/dev): yar-session scheme + stub chooser.
        // Enforces the idle-timeout (RA-461) via the same shared authenticate
        // used by the real-OAuth auth-plugin.js, so the two paths can't drift.
        server.auth.scheme('yar-session', () => ({
          authenticate: yarSessionAuthenticate
        }))
        server.auth.strategy('session', 'yar-session')
        server.auth.default('session')
        server.ext('onPreResponse', redirectToLogin)
      }
    }
  }
}
