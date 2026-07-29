import { resubmitConfirmGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const resubmitConfirm = {
  plugin: {
    name: 'resubmit-confirm',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/resubmit-confirm/{applicationId}',
          options: requireOperator,
          ...resubmitConfirmGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/resubmit-confirm/{applicationId}',
          options: requireOperator,
          ...resubmitConfirmGetController
        }
      ])
    }
  }
}
