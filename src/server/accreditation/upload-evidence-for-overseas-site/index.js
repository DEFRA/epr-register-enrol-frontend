import {
  uploadEvidenceListGetController,
  uploadEvidenceListPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const uploadEvidenceForOverseasSite = {
  plugin: {
    name: 'upload-evidence-for-overseas-site',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/upload-evidence-for-overseas-site/{applicationId}',
          options: requireOperator,
          ...uploadEvidenceListGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/upload-evidence-for-overseas-site/{applicationId}',
          options: requireOperator,
          ...uploadEvidenceListGetController
        },
        {
          method: 'POST',
          path: '/accreditation/upload-evidence-for-overseas-site/{applicationId}',
          options: requireOperator,
          ...uploadEvidenceListPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/upload-evidence-for-overseas-site/{applicationId}',
          options: requireOperator,
          ...uploadEvidenceListPostController
        }
      ])
    }
  }
}
