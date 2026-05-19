import {
  confirmOverseasSitesGetController,
  confirmOverseasSitesPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const confirmOverseasSites = {
  plugin: {
    name: 'confirm-overseas-sites',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/confirm-overseas-sites/{applicationId}',
          options: requireOperator,
          ...confirmOverseasSitesGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/confirm-overseas-sites/{applicationId}',
          options: requireOperator,
          ...confirmOverseasSitesGetController
        },
        {
          method: 'POST',
          path: '/accreditation/confirm-overseas-sites/{applicationId}',
          options: requireOperator,
          ...confirmOverseasSitesPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/confirm-overseas-sites/{applicationId}',
          options: requireOperator,
          ...confirmOverseasSitesPostController
        }
      ])
    }
  }
}
