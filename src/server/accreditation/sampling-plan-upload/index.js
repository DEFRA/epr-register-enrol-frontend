import {
  samplingPlanUploadGetController,
  samplingPlanUploadPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const uploadOptions = {
  ...requireOperator,
  payload: {
    maxBytes: 21 * 1024 * 1024,
    output: 'data',
    parse: true,
    multipart: true
  }
}

export const samplingPlanUpload = {
  plugin: {
    name: 'sampling-plan-upload',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/sampling-plan/{applicationId}',
          options: requireOperator,
          ...samplingPlanUploadGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/sampling-plan/{applicationId}',
          options: requireOperator,
          ...samplingPlanUploadGetController
        },
        {
          method: 'POST',
          path: '/accreditation/sampling-plan/{applicationId}',
          options: uploadOptions,
          ...samplingPlanUploadPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/sampling-plan/{applicationId}',
          options: uploadOptions,
          ...samplingPlanUploadPostController
        }
      ])
    }
  }
}
