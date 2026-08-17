import { healthController } from './controller.js'
import { readyController } from './ready-controller.js'

export const health = {
  plugin: {
    name: 'health',
    register(server) {
      server.route({
        method: 'GET',
        path: '/health',
        options: { auth: false },
        ...healthController
      })
      server.route({
        method: 'GET',
        path: '/health/ready',
        options: { auth: false },
        ...readyController
      })
    }
  }
}
