/**
 * Route auth option helpers for enforcing user type at the framework level.
 *
 * Hapi checks the scope before the controller runs, so users authenticated
 * with the wrong provider receive a 403 without entering any handler code.
 *
 * Usage in a route definition:
 *
 *   import { requireRegulator, requireOperator } from '../common/helpers/auth/auth-scopes.js'
 *
 *   server.route({
 *     method: 'GET',
 *     path: '/regulator/dashboard',
 *     options: requireRegulator,
 *     handler: dashboardController
 *   })
 *
 * The helpers can also be spread into a larger options object:
 *
 *   options: { ...requireRegulator, cache: { expiresIn: 5000 } }
 */

export const requireRegulator = { auth: { scope: ['regulator'] } }

export const requireOperator = { auth: { scope: ['operator'] } }
