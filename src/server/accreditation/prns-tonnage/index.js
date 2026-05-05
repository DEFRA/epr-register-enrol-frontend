import {
  prnsTonnageGetController,
  prnsTonnagePostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const prnsTonnage = {
  plugin: {
    name: 'prns-tonnage',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/prns-tonnage/{applicationId}',
          options: requireOperator,
          ...prnsTonnageGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/prns-tonnage/{applicationId}',
          options: requireOperator,
          ...prnsTonnageGetController
        },
        {
          method: 'POST',
          path: '/accreditation/prns-tonnage/{applicationId}',
          options: requireOperator,
          ...prnsTonnagePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/prns-tonnage/{applicationId}',
          options: requireOperator,
          ...prnsTonnagePostController
        }
      ])
    }
  }
}
