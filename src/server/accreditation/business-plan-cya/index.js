import {
  businessPlanCyaGetController,
  businessPlanCyaPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const businessPlanCya = {
  plugin: {
    name: 'business-plan-cya',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/business-plan-cya/{applicationId}',
          options: requireOperator,
          ...businessPlanCyaGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/business-plan-cya/{applicationId}',
          options: requireOperator,
          ...businessPlanCyaGetController
        },
        {
          method: 'POST',
          path: '/accreditation/business-plan-cya/{applicationId}',
          options: requireOperator,
          ...businessPlanCyaPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/business-plan-cya/{applicationId}',
          options: requireOperator,
          ...businessPlanCyaPostController
        }
      ])
    }
  }
}
