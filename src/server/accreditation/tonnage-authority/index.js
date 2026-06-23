import {
  tonnageAuthorityGetController,
  tonnageAuthorityPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const tonnageAuthority = {
  plugin: {
    name: 'tonnage-authority',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/tonnage-authority/{applicationId}',
          options: requireOperator,
          ...tonnageAuthorityGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/tonnage-authority/{applicationId}',
          options: requireOperator,
          ...tonnageAuthorityGetController
        },
        {
          method: 'POST',
          path: '/accreditation/tonnage-authority/{applicationId}',
          options: requireOperator,
          ...tonnageAuthorityPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/tonnage-authority/{applicationId}',
          options: requireOperator,
          ...tonnageAuthorityPostController
        }
      ])
    }
  }
}
