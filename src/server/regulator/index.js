import { requireRegulator } from '../common/helpers/auth/auth-scopes.js'
import { regulatorController } from './controller.js'

/**
 * Sets up the routes used in the regulator page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const regulator = {
  plugin: {
    name: 'regulator',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/regulator',
          options: requireRegulator,
          ...regulatorController
        },
        {
          method: 'GET',
          path: '/{language}/regulator',
          options: requireRegulator,
          ...regulatorController
        }
      ])
    }
  }
}
