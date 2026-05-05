import { prnsCyaGetController, prnsCyaPostController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const prnsCya = {
  plugin: {
    name: 'prns-cya',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/prns-cya/{applicationId}',
          options: requireOperator,
          ...prnsCyaGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/prns-cya/{applicationId}',
          options: requireOperator,
          ...prnsCyaGetController
        },
        {
          method: 'POST',
          path: '/accreditation/prns-cya/{applicationId}',
          options: requireOperator,
          ...prnsCyaPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/prns-cya/{applicationId}',
          options: requireOperator,
          ...prnsCyaPostController
        }
      ])
    }
  }
}
