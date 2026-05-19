import {
  uploadBesEvidenceGetController,
  uploadBesEvidencePostController,
  uploadBesEvidenceGet413Handler
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const uploadOptions = {
  ...requireOperator,
  payload: {
    maxBytes: 21 * 1024 * 1024,
    output: 'data',
    parse: true,
    multipart: { output: 'stream' }
  },
  ext: {
    onPreResponse: { method: uploadBesEvidenceGet413Handler }
  }
}

export const uploadBesEvidence = {
  plugin: {
    name: 'upload-bes-evidence',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/upload-bes-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadBesEvidenceGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/upload-bes-evidence/{applicationId}/{siteId}',
          options: requireOperator,
          ...uploadBesEvidenceGetController
        },
        {
          method: 'POST',
          path: '/accreditation/upload-bes-evidence/{applicationId}/{siteId}',
          options: uploadOptions,
          ...uploadBesEvidencePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/upload-bes-evidence/{applicationId}/{siteId}',
          options: uploadOptions,
          ...uploadBesEvidencePostController
        }
      ])
    }
  }
}
