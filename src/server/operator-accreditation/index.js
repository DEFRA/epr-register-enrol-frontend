import {
  operatorAccreditationController,
  operatorAccreditationExporterController
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
        {
          method: 'GET',
          path: '/operator-accreditation/{organisationId}/{materialType}/{year}',
          options: requireOperator,
          ...operatorAccreditationExporterController
        },
        {
          method: 'GET',
          path: '/{language}/operator-accreditation/{organisationId}/{materialType}/{year}',
          options: requireOperator,
          ...operatorAccreditationExporterController
        }
      ])
    }
  }
}
