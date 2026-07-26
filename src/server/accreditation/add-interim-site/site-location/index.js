import {
  addInterimSiteLocationGetController,
  addInterimSiteLocationPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteSiteLocation = {
  plugin: {
    name: 'addInterimSiteSiteLocation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/site-location',
          options: requireOperator,
          ...addInterimSiteLocationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-location',
          options: requireOperator,
          ...addInterimSiteLocationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/site-location',
          options: requireOperator,
          ...addInterimSiteLocationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-location',
          options: requireOperator,
          ...addInterimSiteLocationPostController
        }
      ])
    }
  }
}
