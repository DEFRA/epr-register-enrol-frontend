import { manageRouteOptions } from './helpers/manage-page.js'
import { manageRegistrationAccreditationController } from './registration-accreditation/controller.js'
import { manageOverseasSitesController } from './overseas-sites/controller.js'

// RA-425: Re/Ex's material page links to MANAGE_PATH, the manage registration
// and accreditation page.
const MANAGE_PATH = '/manage/{organisationId}/{registrationId}/{materialType}'

const ROUTES = [
  [MANAGE_PATH, manageRegistrationAccreditationController],
  [`${MANAGE_PATH}/overseas-sites`, manageOverseasSitesController]
]

export const manage = {
  plugin: {
    name: 'manage',
    register(server) {
      server.route(
        ROUTES.flatMap(([path, controller]) =>
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
