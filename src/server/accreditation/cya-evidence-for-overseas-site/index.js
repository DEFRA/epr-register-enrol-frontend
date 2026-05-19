import {
  cyaEvidenceForSiteGetController,
  cyaEvidenceForSitePostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const cyaEvidenceForOverseasSite = {
  plugin: {
    name: 'cya-evidence-for-overseas-site',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}',
          options: requireOperator,
          ...cyaEvidenceForSiteGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}',
          options: requireOperator,
          ...cyaEvidenceForSiteGetController
        },
        {
          method: 'POST',
          path: '/accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}',
          options: requireOperator,
          ...cyaEvidenceForSitePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/cya-evidence-for-overseas-site/{applicationId}/{siteId}',
          options: requireOperator,
          ...cyaEvidenceForSitePostController
        }
      ])
    }
  }
}
