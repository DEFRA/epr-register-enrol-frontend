import {
  businessPlanDetailGetController,
  businessPlanDetailPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const businessPlanDetail = {
  plugin: {
    name: 'business-plan-detail',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/business-plan-detail/{applicationId}',
          options: requireOperator,
          ...businessPlanDetailGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/business-plan-detail/{applicationId}',
          options: requireOperator,
          ...businessPlanDetailGetController
        },
        {
          method: 'POST',
          path: '/accreditation/business-plan-detail/{applicationId}',
          options: requireOperator,
          ...businessPlanDetailPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/business-plan-detail/{applicationId}',
          options: requireOperator,
          ...businessPlanDetailPostController
        }
      ])
    }
  }
}
