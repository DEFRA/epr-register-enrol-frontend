import {
  operatorAccreditationController,
  operatorDetailsController
} from './controller.js'

/**
 * Sets up the routes used in the operator page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorDetails = {
  plugin: {
    name: 'operator-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-details',
          ...operatorDetailsController
        },
        {
          method: 'GET',
          path: '/{language}/operator-details',
          ...operatorDetailsController
        }
      ])
    }
  }
}
