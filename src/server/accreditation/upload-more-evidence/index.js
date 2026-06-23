import {
  uploadMoreEvidenceGetController,
  uploadMoreEvidencePostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const uploadMoreEvidence = {
  plugin: {
    name: 'upload-more-evidence',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/upload-more-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadMoreEvidenceGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/upload-more-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadMoreEvidenceGetController
        },
        {
          method: 'POST',
          path: '/accreditation/upload-more-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadMoreEvidencePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/upload-more-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadMoreEvidencePostController
        }
      ])
    }
  }
}
