import { requireOperator } from '../../common/helpers/auth/auth-scopes.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'
import {
  addSiteToRequestController,
  addToAccreditationGetController,
  addToAccreditationPostController,
  cancelAddToAccreditationController,
  declarationGetController,
  declarationPostController,
  manageOverseasSitesController,
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

const uploadOptions = {
  ...requireOperator,
  payload: {
    maxBytes: 21 * 1024 * 1024,
    output: 'data',
    parse: true,
    multipart: { output: 'annotated' }
  }
}

const statusOptions = {
  ...requireOperator,
  pre: [provideUploadStatusFromSession(IN_YEAR_BES_UPLOAD_SESSION_KEY)]
}

// RA-492: in-year request to add registered ORSs to a granted accreditation.
const ROUTES = [
  ['GET', BASE, manageOverseasSitesController],
  ['POST', `${BASE}/sites/{siteId}`, addSiteToRequestController],
  ['GET', SITE, addToAccreditationGetController],
  ['POST', SITE, addToAccreditationPostController],
  ['POST', `${SITE}/cancel`, cancelAddToAccreditationController],
  ['GET', `${SITE}/location`, locationGetController],
  ['POST', `${SITE}/location`, locationPostController],
  ['GET', `${SITE}/recycling-operation`, recyclingOperationGetController],
  ['POST', `${SITE}/recycling-operation`, recyclingOperationPostController],
  ['GET', `${SITE}/conditions-of-export`, conditionsOfExportGetController],
  ['POST', `${SITE}/conditions-of-export`, conditionsOfExportPostController],
  ['GET', `${SITE}/bes-evidence`, besEvidenceGetController],
  ['POST', `${SITE}/bes-evidence`, besEvidencePostController, uploadOptions],
  [
    'GET',
    `${SITE}/bes-evidence/status`,
    besEvidenceStatusController,
    statusOptions
  ],
  ['GET', `${BASE}/requests`, requestsGetController],
  ['POST', `${BASE}/requests`, requestsPostController],
  ['GET', `${BASE}/declaration`, declarationGetController],
  ['POST', `${BASE}/declaration`, declarationPostController],
  ['GET', `${BASE}/payment`, paymentGetController]
]

export const manageOverseasSites = {
  plugin: {
    name: 'manage-overseas-sites',
    register(server) {
      for (const prefix of ['', '/{language}']) {
        server.route(
          ROUTES.map(([method, path, controller, options]) => ({
            method,
            path: `${prefix}${path}`,
            options: options ?? requireOperator,
            ...controller
          }))
        )
      }
    }
  }
}
