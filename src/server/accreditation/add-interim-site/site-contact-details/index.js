import {
  addInterimSiteContactDetailsGetController,
  addInterimSiteContactDetailsPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteSiteContactDetails = {
  plugin: {
    name: 'addInterimSiteSiteContactDetails',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addInterimSiteContactDetailsGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addInterimSiteContactDetailsGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addInterimSiteContactDetailsPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addInterimSiteContactDetailsPostController
        }
      ])
    }
  }
}
