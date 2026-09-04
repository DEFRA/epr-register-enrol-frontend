import { config } from '../../config/config.js'
import { isRegulatorAccessDisabled } from '../common/helpers/auth/regulator-access.js'
import {
  regulatorLoginController,
  operatorLoginController,
  regulatorCallbackController,
  operatorCallbackController,
  logoutController
} from './controller.js'
import { dismissSessionNoticeController } from './session-notice/controller.js'
import { stubAuthRoutes } from './stub/index.js'

export const authRoutes = {
  plugin: {
    name: 'auth-routes',
    async register(server) {
      const stubEnabled = config.get('auth.stubEnabled')
      // RA-427: kill switch for the regulator side of the app while no
      // regulator-facing features are built out yet. Every /auth/regulator/*
      // route below is registered conditionally (not just guarded inside the
      // handler) so a disabled route never exists on the router — a request
      // for it 404s the same way an unknown path does.
      const regulatorEnabled = !isRegulatorAccessDisabled()

      server.route({
        method: 'GET',
        path: '/auth/logout',
        options: { auth: false },
        handler: logoutController
      })

      // RA-462: dismiss the concurrent-login notice. Auth required (it acts on
      // the caller's own session) and CSRF-protected like any other POST.
      server.route({
        method: 'POST',
        path: '/auth/session-notice/dismiss',
        handler: dismissSessionNoticeController
      })

      if (stubEnabled) {
        const stubChooserRedirect = (type) => (request, h) => {
          const rt = request.query.rt
          return h.redirect(
            `/auth/stub/login?type=${type}${rt ? `&rt=${encodeURIComponent(rt)}` : ''}`
          )
        }

        const stubLoginRoutes = [
          {
            method: 'GET',
            path: '/auth/operator/login',
            options: { auth: false },
            handler: stubChooserRedirect('operator')
          }
        ]
        if (regulatorEnabled) {
          stubLoginRoutes.push({
            method: 'GET',
            path: '/auth/regulator/login',
            options: { auth: false },
            handler: stubChooserRedirect('regulator')
          })
        }
        server.route(stubLoginRoutes)

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
          regulatorEnabled &&
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
        const oauthRoutes = [
          {
            method: 'GET',
            path: '/auth/operator/login',
            options: { auth: false },
            handler: operatorLoginController
          },
          // OAuth callback — public so the provider redirect can reach it
          {
            method: 'GET',
            path: '/auth/operator/callback',
            options: { auth: false },
            handler: operatorCallbackController
          }
        ]
        if (regulatorEnabled) {
          oauthRoutes.push(
            // Login entry point — initiates OAuth flow with state param
            {
              method: 'GET',
              path: '/auth/regulator/login',
              options: { auth: false },
              handler: regulatorLoginController
            },
            // OAuth callback — public so the provider redirect can reach it
            {
              method: 'GET',
              path: '/auth/regulator/callback',
              options: { auth: false },
              handler: regulatorCallbackController
            }
          )
        }
        server.route(oauthRoutes)
      }
    }
  }
}
