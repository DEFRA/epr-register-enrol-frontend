import {
  addOrsConditionsOfExportGetController,
  addOrsConditionsOfExportPostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteConditionsOfExport = {
  plugin: {
    name: 'addOverseasSiteConditionsOfExport',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/conditions-of-export',
          options: requireOperator,
          ...addOrsConditionsOfExportGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/conditions-of-export',
          options: requireOperator,
          ...addOrsConditionsOfExportGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/conditions-of-export',
          options: requireOperator,
          ...addOrsConditionsOfExportPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/conditions-of-export',
          options: requireOperator,
          ...addOrsConditionsOfExportPostController
        }
      ])
    }
  }
}
