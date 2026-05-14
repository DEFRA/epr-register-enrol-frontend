import {
  fileUploadDetailsGetController,
  fileUploadDetailsPostController
} from './controllers/details-controller.js'
import { fileUploadFormGetController } from './controllers/upload-controller.js'
import { fileUploadStatusController } from './controllers/upload-status-controller.js'
import { fileUploadListController } from './controllers/list-controller.js'
import { fileUploadDetailController } from './controllers/file-controller.js'
import { fileDownloadController } from './controllers/download-controller.js'
import { requireOperator } from '../common/helpers/auth/auth-scopes.js'

export const fileUpload = {
  plugin: {
    name: 'file-upload',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/file-upload',
          options: requireOperator,
          ...fileUploadListController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload',
          options: requireOperator,
          ...fileUploadListController
        },
        {
          method: 'GET',
          path: '/file-upload/add',
          options: requireOperator,
          ...fileUploadDetailsGetController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/add',
          options: requireOperator,
          ...fileUploadDetailsGetController
        },
        {
          method: 'POST',
          path: '/file-upload/add',
          options: requireOperator,
          ...fileUploadDetailsPostController
        },
        {
          method: 'POST',
          path: '/{language}/file-upload/add',
          options: requireOperator,
          ...fileUploadDetailsPostController
        },
        {
          method: 'GET',
          path: '/file-upload/upload',
          options: requireOperator,
          ...fileUploadFormGetController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/upload',
          options: requireOperator,
          ...fileUploadFormGetController
        },
        {
          method: 'GET',
          path: '/file-upload/upload-status',
          options: {
            ...requireOperator,
            pre: fileUploadStatusController.options.pre
          },
          handler: fileUploadStatusController.handler
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/upload-status',
          options: {
            ...requireOperator,
            pre: fileUploadStatusController.options.pre
          },
          handler: fileUploadStatusController.handler
        },
        {
          method: 'GET',
          path: '/file-upload/{fileUploadId}',
          options: requireOperator,
          ...fileUploadDetailController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/{fileUploadId}',
          options: requireOperator,
          ...fileUploadDetailController
        },
        {
          method: 'GET',
          path: '/file-upload/{fileUploadId}/download',
          options: requireOperator,
          ...fileDownloadController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/{fileUploadId}/download',
          options: requireOperator,
          ...fileDownloadController
        }
      ])
    }
  }
}
