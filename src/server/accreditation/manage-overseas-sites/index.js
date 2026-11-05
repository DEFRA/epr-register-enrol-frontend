import { manageRouteOptions } from '../../manage/helpers/manage-page.js'
import { MAX_FILE_BYTES } from '../upload-bes-evidence/controller.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'
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
  IN_YEAR_BES_UPLOAD_SESSION_KEY,
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

const BASE = '/accreditation/manage-overseas-sites/{applicationId}'
const SITE = `${BASE}/add/{siteId}`

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024

// RA-492: in-year change pages, so behind RA-425's inYearChangesEnabled flag
// (404 before auth when off) and for operators only, as the /manage pages.
const uploadOptions = {
  ...manageRouteOptions,
  payload: {
    // The file plus the form's other fields, as the upload-bes-evidence route.
    maxBytes: MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = {
  ...manageRouteOptions,
  pre: [provideUploadStatusFromSession(IN_YEAR_BES_UPLOAD_SESSION_KEY)]
}

// RA-492: in-year request to add registered ORSs to a granted accreditation.
function route(method, path, controller, options = manageRouteOptions) {
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
  route('GET', `${BASE}/payment`, paymentGetController)
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
