import {
  operatorAccreditationController,
  startNewAccreditationController,
  startNewAccreditationExporterController
} from './controller.js'
import { requireOperator } from '../common/helpers/auth/auth-scopes.js'
import { usesRegistrationNumber } from '../common/helpers/accreditationUrls.js'

// RA-765: a URL by registration number has the manage page's material, which
// names glass by its recycling process. A URL by ReEx's ids still doesn't.
const landingRouteOptions = {
  ...requireOperator,
  plugins: {
    routeParamsGuard: { glassRecyclingProcesses: usesRegistrationNumber }
  }
}

export const operatorAccreditation = {
  plugin: {
    name: 'operator-accreditation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}',
          options: landingRouteOptions,
          ...operatorAccreditationController
        },
        {
          method: 'GET',
          path: '/{language}/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}',
          options: landingRouteOptions,
          ...operatorAccreditationController
        },
        // RA-357: restarting after a withdrawal creates an application, so it
        // is a POST carrying a crumb token rather than a flag on the GETs
        // above. Each GET variant gets a matching POST.
        {
          method: 'POST',
          path: '/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}/start-new',
          options: requireOperator,
          ...startNewAccreditationController
        },
        {
          method: 'POST',
          path: '/{language}/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}/start-new',
          options: requireOperator,
          ...startNewAccreditationController
        },
        {
          method: 'POST',
          path: '/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}/exporter/start-new',
          options: requireOperator,
          ...startNewAccreditationExporterController
        },
        {
          method: 'POST',
          path: '/{language}/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}/exporter/start-new',
          options: requireOperator,
          ...startNewAccreditationExporterController
        }
      ])
    }
  }
}
