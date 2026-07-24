import {
  addOrsBaselCodeGetController,
  addOrsBaselCodePostController
} from './controller.js'
import { requireOperator } from '../../../common/helpers/auth/auth-scopes.js'

export const addOverseasSiteBaselCode = {
  plugin: {
    name: 'addOverseasSiteBaselCode',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/add-overseas-site/{applicationId}/basel-convention-and-oecd-code',
          options: requireOperator,
          ...addOrsBaselCodeGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/basel-convention-and-oecd-code',
          options: requireOperator,
          ...addOrsBaselCodeGetController
        },
        {
          method: 'POST',
          path: '/accreditation/add-overseas-site/{applicationId}/basel-convention-and-oecd-code',
          options: requireOperator,
          ...addOrsBaselCodePostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/add-overseas-site/{applicationId}/basel-convention-and-oecd-code',
          options: requireOperator,
          ...addOrsBaselCodePostController
        }
      ])
    }
  }
}
