import {
  businessPlanGetController,
  businessPlanPostController,
  businessPlanPayloadSchema
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const postOptions = {
  ...requireOperator,
  validate: { payload: businessPlanPayloadSchema }
}

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
          options: postOptions,
          ...businessPlanPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/business-plan/{applicationId}',
          options: postOptions,
          ...businessPlanPostController
        }
      ])
    }
  }
}
