import {
  checkSiteConditionsGetController,
  checkSiteConditionsPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const checkSiteConditions = {
  plugin: {
    name: 'check-site-conditions',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/check-site-conditions/{applicationId}/{siteId}',
          options: requireOperator,
          ...checkSiteConditionsGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/check-site-conditions/{applicationId}/{siteId}',
          options: requireOperator,
          ...checkSiteConditionsGetController
        },
        {
          method: 'POST',
          path: '/accreditation/check-site-conditions/{applicationId}/{siteId}',
          options: requireOperator,
          ...checkSiteConditionsPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/check-site-conditions/{applicationId}/{siteId}',
          options: requireOperator,
          ...checkSiteConditionsPostController
        }
      ])
    }
  }
}
