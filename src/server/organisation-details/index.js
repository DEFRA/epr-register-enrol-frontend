import { organisationDetailsController } from './controller.js'

/**
 * Sets up the routes used in the organisation list page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const organisationDetails = {
  plugin: {
    name: 'organisation-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/organisation-details',
          ...organisationDetailsController
        },
        {
          method: 'GET',
          path: '/organisation-details/{organisationId}',
          ...organisationDetailsController
        },
        {
          method: 'GET',
          path: '/{language}/organisation-details/{organisationId}',
          ...organisationDetailsController
        }
      ])
    }
  }
}
