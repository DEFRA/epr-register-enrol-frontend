import {
  fileUploadDetailsGetController,
  fileUploadDetailsPostController
} from './controllers/details-controller.js'
import { fileUploadFormGetController } from './controllers/upload-controller.js'
import { fileUploadStatusController } from './controllers/upload-status-controller.js'
import { fileUploadListController } from './controllers/list-controller.js'
import { fileUploadDetailController } from './controllers/file-controller.js'
import { fileDownloadController } from './controllers/download-controller.js'

export const fileUpload = {
  plugin: {
    name: 'file-upload',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/file-upload',
          ...fileUploadListController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload',
          ...fileUploadListController
        },
        {
          method: 'GET',
          path: '/file-upload/add',
          ...fileUploadDetailsGetController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/add',
          ...fileUploadDetailsGetController
        },
        {
          method: 'POST',
          path: '/file-upload/add',
          ...fileUploadDetailsPostController
        },
        {
          method: 'POST',
          path: '/{language}/file-upload/add',
          ...fileUploadDetailsPostController
        },
        {
          method: 'GET',
          path: '/file-upload/upload',
          ...fileUploadFormGetController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/upload',
          ...fileUploadFormGetController
        },
        {
          method: 'GET',
          path: '/file-upload/upload-status',
          ...fileUploadStatusController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/upload-status',
          ...fileUploadStatusController
        },
        {
          method: 'GET',
          path: '/file-upload/{fileUploadId}',
          ...fileUploadDetailController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/{fileUploadId}',
          ...fileUploadDetailController
        },
        {
          method: 'GET',
          path: '/file-upload/{fileUploadId}/download',
          ...fileDownloadController
        },
        {
          method: 'GET',
          path: '/{language}/file-upload/{fileUploadId}/download',
          ...fileDownloadController
        }
      ])
    }
  }
}
