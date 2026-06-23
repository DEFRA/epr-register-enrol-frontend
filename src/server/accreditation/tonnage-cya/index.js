import {
  tonnageCyaGetController,
  tonnageCyaPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const tonnageCya = {
  plugin: {
    name: 'tonnage-cya',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/tonnage-cya/{applicationId}',
          options: requireOperator,
          ...tonnageCyaGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/tonnage-cya/{applicationId}',
          options: requireOperator,
          ...tonnageCyaGetController
        },
        {
          method: 'POST',
          path: '/accreditation/tonnage-cya/{applicationId}',
          options: requireOperator,
          ...tonnageCyaPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/tonnage-cya/{applicationId}',
          options: requireOperator,
          ...tonnageCyaPostController
        }
      ])
    }
  }
}
