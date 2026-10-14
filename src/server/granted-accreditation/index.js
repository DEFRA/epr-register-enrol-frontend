import { requireOperator } from '../common/helpers/auth/auth-scopes.js'
import {
  grantedAccreditationController,
  preparedProposalController
} from './controller.js'

export const grantedAccreditation = {
  plugin: {
    name: 'granted-accreditation',
    register(server) {
      const targetPath =
        '/granted-accreditation/{organisationId}/{registrationId}/{accreditationId}/{materialType}/{year}'
      for (const prefix of ['', '/{language}']) {
        server.route([
          {
            method: 'GET',
            path: `${prefix}${targetPath}`,
            options: requireOperator,
            ...grantedAccreditationController
          },
          {
            method: 'GET',
            path: `${prefix}${targetPath}/change`,
            options: requireOperator,
            ...preparedProposalController
          }
        ])
      }
    }
  }
}
