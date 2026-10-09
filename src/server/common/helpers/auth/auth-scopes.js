/**
 * Route auth option helpers for enforcing user type at the framework level.
 *
 * Hapi checks the scope before the controller runs, so a session without the
 * required scope receives a 403 without entering any handler code.
 *
 * Usage in a route definition:
 *
 *   import { requireOperator } from '../common/helpers/auth/auth-scopes.js'
 *
 *   server.route({
 *     method: 'GET',
 *     path: '/operator/dashboard',
 *     options: requireOperator,
 *     handler: dashboardController
 *   })
 *
 * The helper can also be spread into a larger options object:
 *
 *   options: { ...requireOperator, cache: { expiresIn: 5000 } }
 */

export const requireOperator = { auth: { scope: ['operator'] } }
