import Boom from '@hapi/boom'

import { requireRegulator } from '../common/helpers/auth/auth-scopes.js'
import { isRegulatorAccessDisabled } from '../common/helpers/auth/regulator-access.js'
import { regulatorController } from './controller.js'

function notFoundController() {
  throw Boom.notFound()
}

/**
 * Sets up the routes used in the regulator page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 *
 * RA-427: when regulator access is disabled, the routes stay registered
 * (rather than being left unregistered) but resolve to a plain 404 with
 * auth off — leaving them unregistered would let the home page's `/{language}`
 * catch-all swallow `/regulator` as an invalid language param and 400 it
 * instead, and gating on auth alone would 302 an unauthenticated caller to
 * login before ever reaching the "disabled" state.
 */
export const regulator = {
  plugin: {
    name: 'regulator',
    register(server) {
      const disabled = isRegulatorAccessDisabled()
      const options = disabled ? { auth: false } : requireRegulator
      const routeHandler = disabled
        ? { handler: notFoundController }
        : regulatorController

      server.route([
        {
          method: 'GET',
          path: '/regulator',
          options,
          ...routeHandler
        },
        {
          method: 'GET',
          path: '/{language}/regulator',
          options,
          ...routeHandler
        }
      ])
    }
  }
}
