import {
  prnsAuthorityGetController,
  prnsAuthorityPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const prnsAuthority = {
  plugin: {
    name: 'prns-authority',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/prns-authority/{applicationId}',
          options: requireOperator,
          ...prnsAuthorityGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/prns-authority/{applicationId}',
          options: requireOperator,
          ...prnsAuthorityGetController
        },
        {
          method: 'POST',
          path: '/accreditation/prns-authority/{applicationId}',
          options: requireOperator,
          ...prnsAuthorityPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/prns-authority/{applicationId}',
          options: requireOperator,
          ...prnsAuthorityPostController
        }
      ])
    }
  }
}
