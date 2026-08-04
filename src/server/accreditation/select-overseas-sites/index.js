import {
  selectOverseasSitesGetController,
  selectOverseasSitesPostController,
  selectOverseasSitesPromoteEntryGetController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const selectOverseasSites = {
  plugin: {
    name: 'select-overseas-sites',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/select-overseas-sites/{applicationId}',
          options: requireOperator,
          ...selectOverseasSitesGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/select-overseas-sites/{applicationId}',
          options: requireOperator,
          ...selectOverseasSitesGetController
        },
        {
          method: 'GET',
          path: '/accreditation/select-overseas-sites/{applicationId}/promote/{siteId}',
          options: requireOperator,
          ...selectOverseasSitesPromoteEntryGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/select-overseas-sites/{applicationId}/promote/{siteId}',
          options: requireOperator,
          ...selectOverseasSitesPromoteEntryGetController
        },
        {
          method: 'POST',
          path: '/accreditation/select-overseas-sites/{applicationId}',
          options: requireOperator,
          ...selectOverseasSitesPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/select-overseas-sites/{applicationId}',
          options: requireOperator,
          ...selectOverseasSitesPostController
        }
      ])
    }
  }
}
