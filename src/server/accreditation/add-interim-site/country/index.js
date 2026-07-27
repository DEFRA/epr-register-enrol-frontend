import {
  addInterimSiteCountryGetController,
  addInterimSiteCountryPostController,
  addInterimSiteCancelController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addInterimSiteCountry = {
  plugin: {
    name: 'addInterimSiteCountry',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/country',
          options: requireOperator,
          ...addInterimSiteCountryGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/country',
          options: requireOperator,
          ...addInterimSiteCountryGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-interim-site/{applicationId}/country',
          options: requireOperator,
          ...addInterimSiteCountryPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/country',
          options: requireOperator,
          ...addInterimSiteCountryPostController
        },
        {
          method: 'GET',
          path: '/accreditation/add-interim-site/{applicationId}/cancel',
          options: requireOperator,
          ...addInterimSiteCancelController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-interim-site/{applicationId}/cancel',
          options: requireOperator,
          ...addInterimSiteCancelController
        }
      ])
    }
  }
}
