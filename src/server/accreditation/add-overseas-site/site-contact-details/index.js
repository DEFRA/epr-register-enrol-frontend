import {
  addOrsSiteContactDetailsGetController,
  addOrsSiteContactDetailsPostController,
  siteContactDetailsPayloadSchema
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

const postOptions = {
  ...requireOperator,
  validate: { payload: siteContactDetailsPayloadSchema }
}

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
          options: postOptions,
          ...addOrsSiteContactDetailsPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/site-contact-details',
          options: postOptions,
          ...addOrsSiteContactDetailsPostController
        }
      ])
    }
  }
}
