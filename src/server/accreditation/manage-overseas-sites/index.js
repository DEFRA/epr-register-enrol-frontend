import Joi from 'joi'

import { manageRouteOptions } from '../../manage/helpers/manage-page.js'
import { MAX_FILE_BYTES } from '../upload-bes-evidence/controller.js'
import {
  addSiteToRequestController,
  addToAccreditationGetController,
  addToAccreditationPostController,
  cancelAddToAccreditationController,
  removeBesEvidenceFileController,
  declarationGetController,
  declarationPostController,
  paymentGetController,
  requestsGetController,
  requestsPostController
} from './controller.js'
import {
  besEvidenceStatusPre,
  besEvidenceGetController,
  besEvidencePostController,
  besEvidenceStatusController,
  conditionsOfExportGetController,
  conditionsOfExportPostController,
  locationGetController,
  locationPostController,
  recyclingOperationGetController,
  recyclingOperationPostController
} from './steps-controller.js'
import {
  cancelUpdateController,
  detailsGetController,
  stepGetController,
  stepPostController,
  submittedGetController
} from './update/controller.js'
import {
  interimAdditionGetController,
  interimAdditionPostController,
  interimChangeGetController,
  interimChangePostController,
  interimNewGetController,
  interimNewPostController,
  interimRemoveController,
  interimUndoController
} from './update/interim-controller.js'
import {
  besEvidenceFileDeleteController as updateBesFileDeleteController,
  besEvidenceGetController as updateBesGetController,
  besEvidencePostController as updateBesPostController,
  besEvidenceStatusController as updateBesStatusController,
  besEvidenceStatusPre as updateBesStatusPre
} from './update/bes-controller.js'
import { STEP_NAMES, UPDATED_KEYS } from './update/steps.js'

const BASE = '/accreditation/manage-overseas-sites/{applicationId}'
const SITE = `${BASE}/add/{siteId}`
const UPDATE = `${BASE}/update/{siteId}`

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024

// A malformed id in the URL is a bad request (Hapi's default for invalid
// params). siteId is converted to the integer the backend uses.
const routeOptions = {
  ...manageRouteOptions,
  validate: {
    params: Joi.object({
      language: Joi.string(),
      applicationId: Joi.string().required(),
      siteId: Joi.number().integer().positive(),
      fileId: Joi.string()
    })
  }
}

// RA-492: in-year change pages, so behind RA-425's inYearChangesEnabled flag
// (404 before auth when off) and for operators only, as the /manage pages.
const uploadOptions = {
  ...routeOptions,
  payload: {
    // The file plus the form's other fields, as the upload-bes-evidence route.
    maxBytes: MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = { ...routeOptions, pre: besEvidenceStatusPre }

// `updated` names the success banner's translation key, so only known ones pass.
const updateOptions = {
  ...routeOptions,
  validate: {
    ...routeOptions.validate,
    params: routeOptions.validate.params.keys({
      interimSiteId: Joi.number().integer().positive(),
      changeId: Joi.string().guid(),
      step: Joi.string().valid(...STEP_NAMES)
    }),
    query: Joi.object({
      updated: Joi.string().valid(...Object.keys(UPDATED_KEYS))
    }).unknown()
  }
}

const updateUploadOptions = { ...updateOptions, payload: uploadOptions.payload }
const updateStatusOptions = { ...updateOptions, pre: updateBesStatusPre }

// The request the declaration just submitted. A value that is not an id is
// refused; an id that matches no submitted request falls back to the newest.
const submittedOptions = {
  ...routeOptions,
  validate: {
    ...routeOptions.validate,
    query: Joi.object({ request: Joi.string().guid() }).unknown()
  }
}

// RA-492: in-year request to add registered ORSs to a granted accreditation.
function route(method, path, controller, options = routeOptions) {
  return { method, path, options, ...controller }
}

const ROUTES = [
  route('POST', `${BASE}/sites/{siteId}`, addSiteToRequestController),
  route('GET', SITE, addToAccreditationGetController),
  route('POST', SITE, addToAccreditationPostController),
  route('POST', `${SITE}/cancel`, cancelAddToAccreditationController),
  route('GET', `${SITE}/location`, locationGetController),
  route('POST', `${SITE}/location`, locationPostController),
  route('GET', `${SITE}/recycling-operation`, recyclingOperationGetController),
  route(
    'POST',
    `${SITE}/recycling-operation`,
    recyclingOperationPostController
  ),
  route('GET', `${SITE}/conditions-of-export`, conditionsOfExportGetController),
  route(
    'POST',
    `${SITE}/conditions-of-export`,
    conditionsOfExportPostController
  ),
  route('GET', `${SITE}/bes-evidence`, besEvidenceGetController),
  route(
    'POST',
    `${SITE}/bes-evidence/{fileId}/delete`,
    removeBesEvidenceFileController
  ),
  route(
    'POST',
    `${SITE}/bes-evidence`,
    besEvidencePostController,
    uploadOptions
  ),
  route(
    'GET',
    `${SITE}/bes-evidence/status`,
    besEvidenceStatusController,
    statusOptions
  ),
  route('GET', `${BASE}/requests`, requestsGetController),
  route('POST', `${BASE}/requests`, requestsPostController),
  route('GET', `${BASE}/declaration`, declarationGetController),
  route('POST', `${BASE}/declaration`, declarationPostController),
  route('GET', `${BASE}/payment`, paymentGetController, submittedOptions),
  route('GET', `${BASE}/submitted`, submittedGetController, submittedOptions),
  route('GET', UPDATE, detailsGetController, updateOptions),
  route('POST', `${UPDATE}/cancel`, cancelUpdateController, updateOptions),
  route('GET', `${UPDATE}/details/{step}`, stepGetController, updateOptions),
  route('POST', `${UPDATE}/details/{step}`, stepPostController, updateOptions),
  route('GET', `${UPDATE}/bes-evidence`, updateBesGetController, updateOptions),
  route(
    'POST',
    `${UPDATE}/bes-evidence`,
    updateBesPostController,
    updateUploadOptions
  ),
  route(
    'GET',
    `${UPDATE}/bes-evidence/status`,
    updateBesStatusController,
    updateStatusOptions
  ),
  route(
    'POST',
    `${UPDATE}/bes-evidence/{fileId}/delete`,
    updateBesFileDeleteController,
    updateOptions
  ),
  route(
    'GET',
    `${UPDATE}/interim-sites/new`,
    interimNewGetController,
    updateOptions
  ),
  route(
    'POST',
    `${UPDATE}/interim-sites/new`,
    interimNewPostController,
    updateOptions
  ),
  route(
    'GET',
    `${UPDATE}/interim-sites/{interimSiteId}`,
    interimChangeGetController,
    updateOptions
  ),
  route(
    'POST',
    `${UPDATE}/interim-sites/{interimSiteId}`,
    interimChangePostController,
    updateOptions
  ),
  route(
    'POST',
    `${UPDATE}/interim-sites/{interimSiteId}/remove`,
    interimRemoveController,
    updateOptions
  ),
  route(
    'GET',
    `${UPDATE}/interim-site-changes/{changeId}`,
    interimAdditionGetController,
    updateOptions
  ),
  route(
    'POST',
    `${UPDATE}/interim-site-changes/{changeId}`,
    interimAdditionPostController,
    updateOptions
  ),
  route(
    'POST',
    `${UPDATE}/interim-site-changes/{changeId}/undo`,
    interimUndoController,
    updateOptions
  )
]

export const manageOverseasSites = {
  plugin: {
    name: 'manage-overseas-sites',
    register(server) {
      for (const prefix of ['', '/{language}']) {
        server.route(
          ROUTES.map((definition) => ({
            ...definition,
            path: prefix + definition.path
          }))
        )
      }
    }
  }
}
