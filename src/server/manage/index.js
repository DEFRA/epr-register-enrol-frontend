import { manageRouteOptions } from './helpers/manage-page.js'
import { manageRegistrationAccreditationController } from './registration-accreditation/controller.js'
import { manageOverseasSitesController } from './overseas-sites/controller.js'
import { manageChangeRequestsController } from './change-requests/controller.js'

// RA-425: Re/Ex's material page links to MANAGE_PATH, the manage registration
// and accreditation page.
const MANAGE_PATH = '/manage/{organisationId}/{registrationId}/{materialType}'

const ROUTES = [
  { path: MANAGE_PATH, controller: manageRegistrationAccreditationController },
  {
    path: `${MANAGE_PATH}/overseas-sites`,
    controller: manageOverseasSitesController
  },
  // RA-697: open to reprocessors too, whose changes are tonnage band upgrades.
  {
    path: `${MANAGE_PATH}/change-requests`,
    controller: manageChangeRequestsController
  }
]

export const manage = {
  plugin: {
    name: 'manage',
    register(server) {
      server.route(
        ROUTES.flatMap(({ path, controller }) =>
          [path, `/{language}${path}`].map((routePath) => ({
            method: 'GET',
            path: routePath,
            options: manageRouteOptions,
            ...controller
          }))
        )
      )
    }
  }
}
