import {
  addOrsSiteContactDetailsGetController,
  addOrsSiteContactDetailsPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteSiteContactDetails = {
  plugin: {
    name: 'addOverseasSiteSiteContactDetails',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addOrsSiteContactDetailsGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addOrsSiteContactDetailsGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addOrsSiteContactDetailsPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-contact-details',
          options: requireOperator,
          ...addOrsSiteContactDetailsPostController
        }
      ])
    }
  }
}
