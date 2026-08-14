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

// Internal regulator sub-roles, derived from the Entra ID app role a caller
// holds at sign-in (see regulatorCallbackController). Support users are
// currently granted the same access as standard regulators — there are no
// mutating actions in this service yet — but routes can be locked down to
// requireRegulatorStandard once that distinction matters.
export const ROLE_REGULATOR_STANDARD = 'regulator-standard'
export const ROLE_REGULATOR_SUPPORT_READONLY = 'regulator-support-readonly'

export const requireRegulatorStandard = {
  auth: { scope: [ROLE_REGULATOR_STANDARD] }
}
