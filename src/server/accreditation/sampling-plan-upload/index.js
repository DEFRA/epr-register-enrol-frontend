import {
  samplingPlanUploadGetController,
  samplingPlanUploadPostController,
  samplingPlanCdpStatusController,
  SAMPLING_PLAN_UPLOAD_SESSION_KEY
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'

const uploadOptions = {
  ...requireOperator,
  payload: {
    maxBytes: 200 * 1024 * 1024,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = {
  ...requireOperator,
  pre: [provideUploadStatusFromSession(SAMPLING_PLAN_UPLOAD_SESSION_KEY)]
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
        },
        {
          method: 'GET',
          path: '/accreditation/sampling-plan/{applicationId}/status',
          options: statusOptions,
          ...samplingPlanCdpStatusController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/sampling-plan/{applicationId}/status',
          options: statusOptions,
          ...samplingPlanCdpStatusController
        }
      ])
    }
  }
}
