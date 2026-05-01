import {
  materialSelectionGetController,
  materialSelectionPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const materialSelection = {
  plugin: {
    name: 'material-selection',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/material-selection',
          options: requireOperator,
          ...materialSelectionGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/material-selection',
          options: requireOperator,
          ...materialSelectionGetController
        },
        {
          method: 'POST',
          path: '/accreditation/material-selection',
          options: requireOperator,
          ...materialSelectionPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/material-selection',
          options: requireOperator,
          ...materialSelectionPostController
        }
      ])
    }
  }
}
