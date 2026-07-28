import {
  withdrawApplicationGetController,
  withdrawApplicationPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const withdrawApplication = {
  plugin: {
    name: 'withdraw-application',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/withdraw-application/{applicationId}',
          options: requireOperator,
          ...withdrawApplicationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/withdraw-application/{applicationId}',
          options: requireOperator,
          ...withdrawApplicationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/withdraw-application/{applicationId}',
          options: requireOperator,
          ...withdrawApplicationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/withdraw-application/{applicationId}',
          options: requireOperator,
          ...withdrawApplicationPostController
        }
      ])
    }
  }
}
