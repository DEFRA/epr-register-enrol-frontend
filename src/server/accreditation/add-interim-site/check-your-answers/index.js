import {
  addInterimSiteCyaGetController,
  addInterimSiteCyaPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteCya = {
  plugin: {
    name: 'addInterimSiteCya',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addInterimSiteCyaGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addInterimSiteCyaGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addInterimSiteCyaPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/check-your-answers',
          options: requireOperator,
          ...addInterimSiteCyaPostController
        }
      ])
    }
  }
}
