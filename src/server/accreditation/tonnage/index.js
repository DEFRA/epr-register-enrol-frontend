import {
  tonnageGetController,
  tonnagePostController,
  tonnagePayloadSchema
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const postOptions = {
  ...requireOperator,
  validate: { payload: tonnagePayloadSchema }
}

export const tonnage = {
  plugin: {
    name: 'tonnage',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/tonnage/{applicationId}',
          options: requireOperator,
          ...tonnageGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/tonnage/{applicationId}',
          options: requireOperator,
          ...tonnageGetController
        },
        {
          method: 'POST',
          path: '/accreditation/tonnage/{applicationId}',
          options: postOptions,
          ...tonnagePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/tonnage/{applicationId}',
          options: postOptions,
          ...tonnagePostController
        }
      ])
    }
  }
}
