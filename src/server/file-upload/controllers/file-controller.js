import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { fileUploadApiService } from '../helpers/file-upload-api-service.js'

export const fileUploadDetailController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const { fileUploadId } = request.params

    let file
    try {
      file = await fileUploadApiService.getFileUpload(fileUploadId)
    } catch (err) {
      request.server.logger.error(
        `Error fetching file upload ${fileUploadId}: ${err.message}`
      )
      if (err.status === 404) return h.response().code(404)
      return h.view('file-upload/views/file', {
        pageTitle: t('pages.fileUpload.file.title'),
        heading: t('pages.fileUpload.file.heading'),
        error: t('pages.fileUpload.file.errorLoading')
      }).code(500)
    }

    return h.view('file-upload/views/file', {
      pageTitle: t('pages.fileUpload.file.title'),
      heading: t('pages.fileUpload.file.heading'),
      file,
      backLink: '/file-upload'
    })
  }
}
