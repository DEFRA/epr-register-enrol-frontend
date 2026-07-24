import {
  addOrsRecyclingOperationGetController,
  addOrsRecyclingOperationPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteRecyclingOperationDetails = {
  plugin: {
    name: 'addOverseasSiteRecyclingOperationDetails',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addOrsRecyclingOperationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addOrsRecyclingOperationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addOrsRecyclingOperationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addOrsRecyclingOperationPostController
        }
      ])
    }
  }
}
