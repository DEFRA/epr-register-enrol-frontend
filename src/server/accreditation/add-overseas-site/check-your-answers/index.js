import {
  addOrsCyaGetController,
  addOrsCyaPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteCya = {
  plugin: {
    name: 'addOverseasSiteCya',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addOrsCyaGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addOrsCyaGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addOrsCyaPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addOrsCyaPostController
        }
      ])
    }
  }
}
