import { operatorOrganisationDetailsController } from './controller.js'

/**
 * Sets up the routes used in the organisation list page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorOrganisationDetails = {
  plugin: {
    name: 'operator-organisation-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-organisation-details/{companiesHouseNo}',
          ...operatorOrganisationDetailsController
        },
        {
          method: 'GET',
          path: '/{language}/operator-organisation-details/{companiesHouseNo}',
          ...operatorOrganisationDetailsController 
        }
      ])
    }
  }
}
