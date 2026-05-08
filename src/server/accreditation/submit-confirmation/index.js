import { submitConfirmationGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const submitConfirmation = {
  plugin: {
    name: 'submit-confirmation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/submit-confirmation/{applicationId}',
          options: requireOperator,
          ...submitConfirmationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/submit-confirmation/{applicationId}',
          options: requireOperator,
          ...submitConfirmationGetController
        }
      ])
    }
  }
}
