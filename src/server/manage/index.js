import { manageRouteOptions } from './helpers/manage-page.js'
import { manageDashboardController } from './dashboard/controller.js'
import { manageRegistrationAccreditationController } from './registration-accreditation/controller.js'
import { manageOverseasSitesController } from './overseas-sites/controller.js'

const DASHBOARD_PATH =
  '/manage/{organisationId}/{registrationId}/{materialType}'

const ROUTES = [
  [DASHBOARD_PATH, manageDashboardController],
  [
    `${DASHBOARD_PATH}/registration-accreditation`,
    manageRegistrationAccreditationController
  ],
  [`${DASHBOARD_PATH}/overseas-sites`, manageOverseasSitesController]
]

/**
 * RA-425: read-only pages for an operator's current accreditation, behind the
 * manageOverseasSitesEnabled flag. Registered in src/server/router.js, under
 * both the default and the /{language} path.
 */
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
