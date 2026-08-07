import { cookiesController } from './controller.js'

/**
 * Sets up the routes used in the /cookies page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const cookies = {
  plugin: {
    name: 'cookies',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/cookies',
          ...cookiesController
        },
        {
          method: 'GET',
          path: '/{language}/cookies',
          ...cookiesController
        }
      ])
    }
  }
}
