import {
  uploadBesEvidenceGetController,
  uploadBesEvidencePostController,
  besEvidenceCdpStatusController,
  BES_EVIDENCE_UPLOAD_SESSION_KEY
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'

const uploadOptions = {
  ...requireOperator,
  payload: {
    maxBytes: 21 * 1024 * 1024,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = {
  ...requireOperator,
  pre: [provideUploadStatusFromSession(BES_EVIDENCE_UPLOAD_SESSION_KEY)]
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
        },
        {
          method: 'GET',
          path: '/accreditation/upload-bes-evidence/{applicationId}/{siteId}/status',
          options: statusOptions,
          ...besEvidenceCdpStatusController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/upload-bes-evidence/{applicationId}/{siteId}/status',
          options: statusOptions,
          ...besEvidenceCdpStatusController
        }
      ])
    }
  }
}
