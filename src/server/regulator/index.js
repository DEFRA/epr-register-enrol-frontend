import { regulatorController } from './controller.js'

/**
 * Sets up the routes used in the regulator page.
 * These routes are registered in src/server/router.js.
 */
export const regulator = {
  plugin: {
    name: 'regulator',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/regulator',
          ...regulatorController
        }
      ])
    }
  }
}
