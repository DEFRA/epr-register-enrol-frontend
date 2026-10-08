import { config } from '../../config/config.js'
import {
  operatorLoginController,
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
        server.route({
          method: 'GET',
          path: '/auth/operator/login',
          options: { auth: false },
          handler(request, h) {
            const rt = request.query.rt
            return h.redirect(
              `/auth/stub/login?type=operator${rt ? `&rt=${encodeURIComponent(rt)}` : ''}`
            )
          }
        })

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

        await server.register([stubAuthRoutes])
      } else {
        server.route([
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
        ])
      }
    }
  }
}
