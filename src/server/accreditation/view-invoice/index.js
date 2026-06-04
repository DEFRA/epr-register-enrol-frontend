import { viewInvoiceGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const viewInvoice = {
  plugin: {
    name: 'view-invoice',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/view-invoice/{applicationId}',
          options: requireOperator,
          ...viewInvoiceGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/view-invoice/{applicationId}',
          options: requireOperator,
          ...viewInvoiceGetController
        }
      ])
    }
  }
}
