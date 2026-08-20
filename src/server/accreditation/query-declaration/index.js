import {
  queryDeclarationGetController,
  queryDeclarationPostController,
  queryDeclarationPayloadSchema
} from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

const postOptions = {
  ...requireOperator,
  validate: {
    payload: queryDeclarationPayloadSchema,
    failAction: 'ignore'
  }
}

export const queryDeclaration = {
  plugin: {
    name: 'query-declaration',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/query-declaration/{applicationId}',
          options: requireOperator,
          ...queryDeclarationGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/query-declaration/{applicationId}',
          options: requireOperator,
          ...queryDeclarationGetController
        },
        {
          method: 'POST',
          path: '/accreditation/query-declaration/{applicationId}',
          options: postOptions,
          ...queryDeclarationPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/query-declaration/{applicationId}',
          options: postOptions,
          ...queryDeclarationPostController
        }
      ])
    }
  }
}
