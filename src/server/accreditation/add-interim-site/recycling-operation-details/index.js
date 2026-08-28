import {
  addInterimSiteRecyclingOperationGetController,
  addInterimSiteRecyclingOperationPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteRecyclingOperationDetails = {
  plugin: {
    name: 'addInterimSiteRecyclingOperationDetails',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addInterimSiteRecyclingOperationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addInterimSiteRecyclingOperationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addInterimSiteRecyclingOperationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/recycling-operation-details',
          options: requireOperator,
          ...addInterimSiteRecyclingOperationPostController
        }
      ])
    }
  }
}
