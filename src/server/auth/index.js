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
            handler: (_, h) => h.redirect('/auth/stub/login?type=regulator')
          },
          {
            method: 'GET',
            path: '/auth/operator/login',
            options: { auth: false },
            handler: (_, h) => h.redirect('/auth/stub/login?type=operator')
          }
        ])

        // If Defra ID credentials are configured, also offer real Defra ID login
        // alongside the stub chooser.
        if (
          config.get('auth.defraId.discoveryUrl') &&
          config.get('auth.defraId.clientId')
        ) {
          server.route([
            {
              method: 'GET',
              path: '/auth/operator/defra-id',
              options: { auth: false },
              handler: operatorLoginController
            },
            {
              method: 'GET',
              path: '/auth/operator/callback',
              options: { auth: false },
              handler: operatorCallbackController
            }
          ])
        }

        // If Entra ID credentials are configured, also offer real Entra ID login
        // alongside the stub chooser.
        if (
          config.get('auth.azureEntraId.clientId') &&
          config.get('auth.azureEntraId.tenantId')
        ) {
          server.route([
            {
              method: 'GET',
              path: '/auth/regulator/entra-id',
              options: { auth: false },
              handler: regulatorLoginController
            },
            {
              method: 'GET',
              path: '/auth/regulator/callback',
              options: { auth: false },
              handler: regulatorCallbackController
            }
          ])
        }

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
