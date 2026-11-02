import { manageRouteOptions } from './helpers/manage-page.js'
import { manageDashboardController } from './dashboard/controller.js'

const DASHBOARD_PATH =
  '/manage/{organisationId}/{registrationId}/{materialType}'

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
        [DASHBOARD_PATH, `/{language}${DASHBOARD_PATH}`].map((path) => ({
          method: 'GET',
          path,
          options: manageRouteOptions,
          ...manageDashboardController
        }))
      )
    }
  }
}
