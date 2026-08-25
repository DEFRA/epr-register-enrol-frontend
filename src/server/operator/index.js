import Boom from '@hapi/boom'

import { isTestPagesDisabled } from '../common/helpers/test-pages-access.js'
import { operatorController } from './controller.js'

function notFoundController() {
  throw Boom.notFound()
}

/**
 * Sets up the routes used in the operator page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 *
 * RA-459: when test pages are disabled, the routes stay registered (rather
 * than being left unregistered) but resolve to a plain 404 with auth off —
 * removing them entirely would let the home page's `/{language}` catch-all
 * swallow `/operator` as an invalid language param and 400 it instead, and
 * gating on auth alone would redirect an unauthenticated caller to login
 * before ever reaching the "disabled" state.
 */
export const operator = {
  plugin: {
    name: 'operator',
    register(server) {
      const disabled = isTestPagesDisabled()
      const routeHandler = disabled
        ? { options: { auth: false }, handler: notFoundController }
        : operatorController

      server.route([
        {
          method: 'GET',
          path: '/operator',
          ...routeHandler
        },
        {
          method: 'GET',
          path: '/{language}/operator',
          ...routeHandler
        }
      ])
    }
  }
}
