import path from 'path'
import hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'
import Crumb from '@hapi/crumb'

import { router } from './router.js'
import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { noStoreCacheHeaders } from './common/helpers/no-store-cache-headers.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCache } from './common/helpers/session-cache/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { concurrentLoginPlugin } from './common/helpers/auth/concurrent-login.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './common/helpers/content-security-policy.js'
import { metrics } from '@defra/cdp-metrics'
import { i18nPlugin } from '../config/i18n.js'
import { authPlugin } from './common/helpers/auth/auth-plugin.js'
import { basicAuthPlugin } from './common/helpers/auth/basic-auth-plugin.js'
import { stubAuthPlugin } from './common/helpers/auth/stub-auth-plugin.js'
import { accreditationSessionGuard } from './common/plugins/accreditationSessionGuard.js'
import { routeParamsGuard } from './common/plugins/route-params-guard.js'

export async function createServer() {
  setupProxy()

  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })

  const authToRegister =
    config.get('auth.stubEnabled') || config.get('isTest')
      ? stubAuthPlugin
      : authPlugin

  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    // authToRegister must register before sessionCache so redirectToLogin's
    // onPreResponse (which stashes the post-login redirect target, RA-403)
    // runs ahead of yar's own onPreResponse commit handler — hapi runs
    // onPreResponse extensions in registration order, and the stash is only
    // persisted if it lands before yar flushes the session. request.yar is
    // still available during authentication despite this ordering: yar's
    // decoration of `request` happens at plugin-registration time
    // (order-independent), and its onPreAuth initializer completes before
    // hapi enters the authentication phase, regardless of which plugin
    // registered first.
    authToRegister,
    sessionCache,
    // RA-462: needs the named session cache (provisioned above) and the auth
    // scheme registered; its onPostAuth runs after authentication regardless
    // of registration order.
    concurrentLoginPlugin,
    basicAuthPlugin,
    i18nPlugin,
    nunjucksConfig,
    Scooter,
    contentSecurityPolicy,
    {
      plugin: Crumb,
      options: {
        // Skip validation in test mode so server.inject() calls work without a token.
        // In all other modes CSRF validation is enforced on state-changing requests.
        skip: () => config.get('isTest'),
        addToViewContext: true,
        cookieOptions: {
          isSecure: config.get('session.cookie.secure'),
          path: '/'
        }
      }
    },
    routeParamsGuard,
    accreditationSessionGuard,
    router // Register all the controllers/routes defined in src/server/router.js
  ])

  server.ext('onPreResponse', catchAll)
  server.ext('onPreResponse', noStoreCacheHeaders)

  return server
}
