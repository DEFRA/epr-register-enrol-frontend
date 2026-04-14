import { operatorRegistrationRenewalController } from './controller.js'

/**
 * Sets up the routes used in the operator registration page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorRegistrationRenewal = {
  plugin: {
    name: 'operator-registration-renewal',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-registration-renewal',
          ...operatorRegistrationRenewalController
        },
        {
          method: 'GET',
          path: '/{language}/operator-registration-renewal',
          ...operatorRegistrationRenewalController
        }
      ])
    }
  }
}
