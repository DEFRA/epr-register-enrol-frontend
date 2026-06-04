import { viewPaymentDetailsGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const viewPaymentDetails = {
  plugin: {
    name: 'view-payment-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/view-payment-details/{applicationId}',
          options: requireOperator,
          ...viewPaymentDetailsGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/view-payment-details/{applicationId}',
          options: requireOperator,
          ...viewPaymentDetailsGetController
        }
      ])
    }
  }
}
