import { worklistItemsController } from './controller.js'

/**
 * Sets up the routes used in the worklist items page.
 * These routes are registered in src/server/router.js.
 */
export const worklistItems = {
  plugin: {
    name: 'worklist-items',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/worklist-items',
          ...worklistItemsController
        }
      ])
    }
  }
}
