import Joi from 'joi'

import { manageRouteOptions } from './helpers/manage-page.js'
import { manageRegistrationAccreditationController } from './registration-accreditation/controller.js'
import { manageOverseasSitesController } from './overseas-sites/controller.js'
import { manageChangeRequestsController } from './change-requests/controller.js'
import { manageChangeRequestDetailController } from './change-requests/detail-controller.js'
import { MAX_FILE_BYTES } from '../accreditation/upload-bes-evidence/controller.js'
import { provideUploadStatusFromSession } from '../common/helpers/upload/provide-upload-status.js'
import {
  RESPOND_BES_UPLOAD_SESSION_KEY,
  besDeleteController,
  besGetController,
  besPostController,
  besStatusController,
  besUploadUrl,
  requireUploadForItem
} from './change-requests/respond/bes.js'
import {
  declarationGetController,
  declarationPostController
} from './change-requests/respond/declaration.js'
import { interimSiteController } from './change-requests/respond/interim-site.js'
import {
  interimStepControllers,
  orsStepControllers
} from './change-requests/respond/steps.js'

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
      itemId: Joi.string().guid().required(),
      interimSiteId: Joi.number().integer().positive(),
      fileId: Joi.string()
    })
  }
}

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024

// RA-698: the file plus the form's other fields, as the BES upload routes.
const uploadOptions = {
  ...itemRouteOptions,
  payload: {
    maxBytes: MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = {
  ...itemRouteOptions,
  pre: [
    requireUploadForItem,
    provideUploadStatusFromSession(RESPOND_BES_UPLOAD_SESSION_KEY, besUploadUrl)
  ]
}

const ITEM = `${MANAGE_PATH}/change-requests/{itemId}`
const INTERIM = `${ITEM}/interim-sites/{interimSiteId}`

// RA-698: the operator's response to a queried item: one page per field the
// query leaves open, then the declaration.
const respond = (method, path, controller, options = itemRouteOptions) => ({
  method,
  path,
  controller,
  options
})
const stepRoutes = (path, { get, post }) => [
  respond('GET', path, get),
  respond('POST', path, post)
]

const ROUTES = [
  {
    path: MANAGE_PATH,
    controller: manageRegistrationAccreditationController
  },
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
    path: ITEM,
    controller: manageChangeRequestDetailController,
    options: itemRouteOptions
  },
  ...stepRoutes(`${ITEM}/site-name`, orsStepControllers['site-name']),
  ...stepRoutes(`${ITEM}/location`, orsStepControllers.location),
  ...stepRoutes(
    `${ITEM}/contact-details`,
    orsStepControllers['contact-details']
  ),
  ...stepRoutes(`${ITEM}/rejected-loads`, orsStepControllers['rejected-loads']),
  respond('GET', `${ITEM}/bes-evidence`, besGetController),
  respond('POST', `${ITEM}/bes-evidence`, besPostController, uploadOptions),
  respond(
    'GET',
    `${ITEM}/bes-evidence/status`,
    besStatusController,
    statusOptions
  ),
  respond('POST', `${ITEM}/bes-evidence/{fileId}/delete`, besDeleteController),
  respond('GET', INTERIM, interimSiteController),
  ...stepRoutes(`${INTERIM}/site-name`, interimStepControllers['site-name']),
  ...stepRoutes(`${INTERIM}/location`, interimStepControllers.location),
  ...stepRoutes(
    `${INTERIM}/contact-details`,
    interimStepControllers['contact-details']
  ),
  respond('GET', `${ITEM}/declaration`, declarationGetController),
  respond('POST', `${ITEM}/declaration`, declarationPostController)
]

export const manage = {
  plugin: {
    name: 'manage',
    register(server) {
      server.route(
        ROUTES.flatMap(
          ({
            method = 'GET',
            path,
            controller,
            options = manageRouteOptions
          }) =>
            [path, `/{language}${path}`].map((routePath) => ({
              method,
              path: routePath,
              options,
              ...controller
            }))
        )
      )
    }
  }
}
