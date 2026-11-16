import Joi from 'joi'

import { manageRouteOptions } from './helpers/manage-page.js'
import { manageRegistrationAccreditationController } from './registration-accreditation/controller.js'
import { manageOverseasSitesController } from './overseas-sites/controller.js'
import { manageChangeRequestsController } from './change-requests/controller.js'
import { manageChangeRequestDetailController } from './change-requests/detail-controller.js'

// RA-425: Re/Ex's material page links to MANAGE_PATH, the manage registration
// and accreditation page. RA-739: keyed by the registration number, not ReEx's
// registration id, so Re/Ex must link with the number.
const MANAGE_PATH =
  '/manage/{organisationId}/{registrationNumber}/{materialType}'

// RA-697: a malformed itemId is a bad request (Hapi's default for invalid
// params), as on RA-492's routes.
const itemRouteOptions = {
  ...manageRouteOptions,
  validate: {
    params: Joi.object({
      language: Joi.string(),
      organisationId: Joi.string().required(),
      registrationNumber: Joi.string().required(),
      materialType: Joi.string().required(),
      itemId: Joi.string().guid().required()
    })
  }
}

const ROUTES = [
  { path: MANAGE_PATH, controller: manageRegistrationAccreditationController },
  {
    path: `${MANAGE_PATH}/overseas-sites`,
    controller: manageOverseasSitesController
  },
  // RA-697: open to reprocessors too, whose changes are tonnage band upgrades.
  {
    path: `${MANAGE_PATH}/change-requests`,
    controller: manageChangeRequestsController
  },
  {
    path: `${MANAGE_PATH}/change-requests/{itemId}`,
    controller: manageChangeRequestDetailController,
    options: itemRouteOptions
  }
]

export const manage = {
  plugin: {
    name: 'manage',
    register(server) {
      server.route(
        ROUTES.flatMap(({ path, controller, options = manageRouteOptions }) =>
          [path, `/{language}${path}`].map((routePath) => ({
            method: 'GET',
            path: routePath,
            options,
            ...controller
          }))
        )
      )
    }
  }
}
