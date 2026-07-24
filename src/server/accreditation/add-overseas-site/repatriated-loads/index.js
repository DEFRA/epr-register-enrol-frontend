import {
  addOrsRepatriatedLoadsGetController,
  addOrsRepatriatedLoadsPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteRepatriatedLoads = {
  plugin: {
    name: 'addOverseasSiteRepatriatedLoads',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/repatriated-loads',
          options: requireOperator,
          ...addOrsRepatriatedLoadsGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/repatriated-loads',
          options: requireOperator,
          ...addOrsRepatriatedLoadsGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/repatriated-loads',
          options: requireOperator,
          ...addOrsRepatriatedLoadsPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/repatriated-loads',
          options: requireOperator,
          ...addOrsRepatriatedLoadsPostController
        }
      ])
    }
  }
}
