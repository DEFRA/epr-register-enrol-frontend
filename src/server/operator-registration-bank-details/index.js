import { operatorRegistrationBankDetailsController } from './controller.js'

/**
 * Sets up the routes used in the operator registration page.
 * These routes are registered in src/server/router.js.
 * Supports both default and language-prefixed paths.
 */
export const operatorRegistrationBankDetails = {
  plugin: {
    name: 'operator-registration-bank-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/operator-registration-bank-details',
          ...operatorRegistrationBankDetailsController
        },
        {
          method: 'GET',
          path: '/{language}/operator-registration-bank-details',
          ...operatorRegistrationBankDetailsController
        }
      ])
    }
  }
}
