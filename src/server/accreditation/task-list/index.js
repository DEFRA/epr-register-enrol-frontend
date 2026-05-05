import { taskListGetController } from './controller.js'
import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'

export const taskList = {
  plugin: {
    name: 'task-list',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/task-list/{applicationId}',
          options: requireOperator,
          ...taskListGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/task-list/{applicationId}',
          options: requireOperator,
          ...taskListGetController
        }
      ])
    }
  }
}
