import { contactController } from './controller.js'

/**
 * Sets up the routes used in the /contact page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const contact = {
  plugin: {
    name: 'contact',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/contact',
          ...contactController
        },
        {
          method: 'GET',
          path: '/{language}/contact',
          ...contactController
        }
      ])
    }
  }
}
