import { queryTaskListGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const queryTaskList = {
  plugin: {
    name: 'query-task-list',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/query-task-list/{applicationId}',
          options: requireOperator,
          ...queryTaskListGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/query-task-list/{applicationId}',
          options: requireOperator,
          ...queryTaskListGetController
        }
      ])
    }
  }
}
