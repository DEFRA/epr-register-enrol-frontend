import {
  addInterimSiteNameGetController,
  addInterimSiteNamePostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteSiteName = {
  plugin: {
    name: 'addInterimSiteSiteName',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/site-name',
          options: requireOperator,
          ...addInterimSiteNameGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-name',
          options: requireOperator,
          ...addInterimSiteNameGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/site-name',
          options: requireOperator,
          ...addInterimSiteNamePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-name',
          options: requireOperator,
          ...addInterimSiteNamePostController
        }
      ])
    }
  }
}
