import { config } from '../../../config/config.js'
import { initUpload } from '../../common/helpers/upload/init-upload.js'
import { FILE_UPLOAD_SESSION_KEY } from '../constants.js'
import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'

export const fileUploadFormGetController = {
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const session = request.yar.get(FILE_UPLOAD_SESSION_KEY) ?? {}

    if (!session.material || !session.year) {
      return h.redirect('/file-upload/add')
    }

    const s3Bucket = config.get('fileUpload.s3Bucket')
    const appBaseUrl = config.get('auth.callbackBaseUrl')

    const uploadDetail = await initUpload({
      redirect: `${appBaseUrl}/file-upload/upload-status`,
      s3Bucket,
      s3Path: `file-uploads/${session.material}/${session.year}`,
      maxFileSize: 1024 * 1024 * 100,
      mimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
      ]
    })

    request.yar.set(FILE_UPLOAD_SESSION_KEY, {
      ...session,
      uploadId: uploadDetail.uploadId,
      statusUrl: uploadDetail.statusUrl
    })

    return h.view('file-upload/views/upload-form', {
      pageTitle: t('pages.fileUpload.upload.title'),
      heading: t('pages.fileUpload.upload.heading'),
      action: uploadDetail.uploadUrl,
      material: session.material,
      year: session.year
    })
  }
}
