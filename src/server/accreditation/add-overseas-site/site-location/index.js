import {
  addOrsSiteLocationGetController,
  addOrsSiteLocationPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteSiteLocation = {
  plugin: {
    name: 'addOverseasSiteSiteLocation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/site-location',
          options: requireOperator,
          ...addOrsSiteLocationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-location',
          options: requireOperator,
          ...addOrsSiteLocationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/site-location',
          options: requireOperator,
          ...addOrsSiteLocationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-location',
          options: requireOperator,
          ...addOrsSiteLocationPostController
        }
      ])
    }
  }
}
