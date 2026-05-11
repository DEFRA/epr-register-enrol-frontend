import {
  submitDeclarationGetController,
  submitDeclarationPostController
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const submitDeclaration = {
  plugin: {
    name: 'submit-declaration',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/submit-declaration/{applicationId}',
          options: requireOperator,
          ...submitDeclarationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/submit-declaration/{applicationId}',
          options: requireOperator,
          ...submitDeclarationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/submit-declaration/{applicationId}',
          options: requireOperator,
          ...submitDeclarationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/submit-declaration/{applicationId}',
          options: requireOperator,
          ...submitDeclarationPostController
        }
      ])
    }
  }
}
