import { operatorRegistrationNewController } from './controller.js'

/**
 * Sets up the routes used in the operator registration page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorRegistrationNew = {
  plugin: {
    name: 'operator-registration-new',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-registration-new',
          ...operatorRegistrationNewController
        },
        {
          method: 'GET',
          path: '/{language}/operator-registration-new',
          ...operatorRegistrationNewController
        }
      ])
    }
  }
}
