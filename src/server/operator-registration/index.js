import { operatorRegistrationController } from './controller.js'

/**
 * Sets up the routes used in the operator registration page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorRegistration = {
  plugin: {
    name: 'operator-registration',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-registration',
          ...operatorRegistrationController
        },
        {
          method: 'GET',
          path: '/{language}/operator-registration',
          ...operatorRegistrationController
        }
      ])
    }
  }
}
