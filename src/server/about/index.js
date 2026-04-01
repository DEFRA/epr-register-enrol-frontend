import { aboutController } from './controller.js'

/**
 * Sets up the routes used in the /about page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const about = {
  plugin: {
    name: 'about',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/about',
          ...aboutController
        },
        {
          method: 'GET',
          path: '/{language}/about',
          ...aboutController
        }
      ])
    }
  }
}
