import {
  addOrsiteNameGetController,
  addOrsiteNamePostController,
  addOrsCancelController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteSiteName = {
  plugin: {
    name: 'addOverseasSiteSiteName',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/site-name',
          options: requireOperator,
          ...addOrsiteNameGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-name',
          options: requireOperator,
          ...addOrsiteNameGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/site-name',
          options: requireOperator,
          ...addOrsiteNamePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-name',
          options: requireOperator,
          ...addOrsiteNamePostController
        },
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/cancel',
          options: requireOperator,
          ...addOrsCancelController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/cancel',
          options: requireOperator,
          ...addOrsCancelController
        }
      ])
    }
  }
}
