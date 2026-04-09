import { config } from '../../config/config.js'
import {
  regulatorLoginController,
  operatorLoginController,
  regulatorCallbackController,
  operatorCallbackController,
  logoutController
} from './controller.js'
import { stubAuthRoutes } from './stub/index.js'

export const authRoutes = {
  plugin: {
    name: 'auth-routes',
    async register(server) {
      const stubEnabled = config.get('auth.stubEnabled')

      server.route({
        method: 'GET',
        path: '/auth/logout',
        options: { auth: false },
        handler: logoutController
      })

      if (stubEnabled) {
        server.route([
          {
            method: 'GET',
            path: '/auth/regulator/login',
            options: { auth: false },
            handler: (request, h) =>
              h.redirect('/auth/stub/login?type=regulator')
          },
          {
            method: 'GET',
            path: '/auth/operator/login',
            options: { auth: false },
            handler: (request, h) =>
              h.redirect('/auth/stub/login?type=operator')
          }
        ])
        await server.register([stubAuthRoutes])
      } else {
        server.route([
          // Login entry points — initiate OAuth flow with state param
          {
            method: 'GET',
            path: '/auth/regulator/login',
            options: { auth: false },
            handler: regulatorLoginController
          },
          {
            method: 'GET',
            path: '/auth/operator/login',
            options: { auth: false },
            handler: operatorLoginController
          },
          // OAuth callbacks — public so the provider redirect can reach them
          {
            method: 'GET',
            path: '/auth/regulator/callback',
            options: { auth: false },
            handler: regulatorCallbackController
          },
          {
            method: 'GET',
            path: '/auth/operator/callback',
            options: { auth: false },
            handler: operatorCallbackController
          }
        ])
      }
    }
  }
}
