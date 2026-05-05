import {
  businessPlanGetController,
  businessPlanPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const businessPlan = {
  plugin: {
    name: 'business-plan',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/business-plan/{applicationId}',
          options: requireOperator,
          ...businessPlanGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/business-plan/{applicationId}',
          options: requireOperator,
          ...businessPlanGetController
        },
        {
          method: 'POST',
          path: '/accreditation/business-plan/{applicationId}',
          options: requireOperator,
          ...businessPlanPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/business-plan/{applicationId}',
          options: requireOperator,
          ...businessPlanPostController
        }
      ])
    }
  }
}
