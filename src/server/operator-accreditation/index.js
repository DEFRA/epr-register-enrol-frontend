import { operatorAccreditationController } from './controller.js'

/**
 * Sets up the routes used in the operator page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorAccreditation = {
  plugin: {
    name: 'operator-accreditation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-accreditation',
          ...operatorAccreditationController
        },
        {
          method: 'GET',
          path: '/{language}/operator-accreditation',
          ...operatorAccreditationController
        }
      ])
    }
  }
}
