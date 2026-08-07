import {
  operatorAccreditationController,
  startNewAccreditationController,
  startNewAccreditationExporterController
} from './controller.js'
import { requireOperator } from '../common/helpers/auth/auth-scopes.js'

export const operatorAccreditation = {
  plugin: {
    name: 'operator-accreditation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}',
          options: requireOperator,
          ...operatorAccreditationController
        },
        {
          method: 'GET',
          path: '/{language}/operator-accreditation/{organisationId}/{registrationId}/{materialType}/{year}',
          options: requireOperator,
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
