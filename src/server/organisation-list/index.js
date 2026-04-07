import { organisationListController } from './controller.js'

/**
 * Sets up the routes used in the organisation list page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const organisationList = {
  plugin: {
    name: 'organisation-list',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/organisation-list',
          ...organisationListController
        },
        {
          method: 'GET',
          path: '/{language}/organisation-list',
          ...organisationListController
        }
      ])
    }
  }
}
