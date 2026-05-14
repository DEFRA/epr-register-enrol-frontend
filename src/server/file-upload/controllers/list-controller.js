import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { fileUploadApiService } from '../helpers/file-upload-api-service.js'

export const fileUploadListController = {
  options: { auth: { mode: 'required' } },
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const organisationId = user?.id ?? 'unknown'

    let files = []
    let fetchError = null

    try {
      files = await fileUploadApiService.listFileUploads(organisationId)
    } catch (err) {
      request.server.logger.error(`Error fetching file uploads: ${err.message}`)
      fetchError = t('pages.fileUpload.list.errorLoading')
    }

    return h.view('file-upload/views/list', {
      pageTitle: t('pages.fileUpload.list.title'),
      heading: t('pages.fileUpload.list.heading'),
      files,
      fetchError
    })
  }
}
