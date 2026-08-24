import Boom from '@hapi/boom'

import { isTestPagesDisabled } from '../common/helpers/test-pages-access.js'
import { homeController } from './controller.js'

function notFoundController() {
  throw Boom.notFound()
}

/**
 * Sets up the routes used in the home page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 *
 * RA-459: when test pages are disabled, the routes stay registered (rather
 * than being left unregistered) but resolve to a plain 404 with auth off.
 * `/{language}` also doubles as the generic single-segment catch-all for
 * every other page in the app — leaving it unregistered here would make it
 * fall through to whichever other route happens to match next instead of
 * 404ing, and gating on auth alone would redirect an unauthenticated caller
 * to login before ever reaching the "disabled" state.
 */
export const home = {
  plugin: {
    name: 'home',
    register(server) {
      const disabled = isTestPagesDisabled()
      const routeHandler = disabled
        ? { options: { auth: false }, handler: notFoundController }
        : homeController

      server.route([
        {
          method: 'GET',
          path: '/',
          ...routeHandler
        },
        {
          method: 'GET',
          path: '/{language}',
          ...routeHandler
        }
      ])
    }
  }
}
