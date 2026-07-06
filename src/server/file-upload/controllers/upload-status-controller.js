import { getLocaleAndTranslator } from '../../common/helpers/get-locale-translator.js'
import { getUser } from '../../common/helpers/auth/get-user.js'
import { config } from '../../../config/config.js'
import { FILE_UPLOAD_SESSION_KEY } from '../constants.js'
import { fileUploadApiService } from '../helpers/file-upload-api-service.js'
import { provideUploadStatusFromSession } from '../../common/helpers/upload/provide-upload-status.js'

export const fileUploadStatusController = {
  options: {
    pre: [provideUploadStatusFromSession(FILE_UPLOAD_SESSION_KEY)]
  },
  async handler(request, h) {
    const { t } = getLocaleAndTranslator(request)
    const user = getUser(request)
    const uploadStatus = request.pre.uploadStatus
    const hasBeenVirusChecked = uploadStatus?.uploadStatus === 'ready'

    if (hasBeenVirusChecked) {
      const fileInput = uploadStatus?.form?.file

      if (fileInput?.hasError) {
        request.yar.flash(
          'error',
          fileInput.errorMessage ?? t('pages.fileUpload.upload.virusError')
        )
        return h.redirect('/file-upload/upload')
      }

      const session = request.yar.get(FILE_UPLOAD_SESSION_KEY) ?? {}

      if (!fileInput) {
        request.yar.flash('error', t('pages.fileUpload.upload.saveError'))
        return h.redirect('/file-upload/upload')
      }

      const processingStatusToScanStatus = {
        validated: 'Clean',
        rejected: 'Infected'
      }
      const scanStatus =
        processingStatusToScanStatus[uploadStatus.processingStatus]

      if (!scanStatus) {
        request.yar.flash('error', t('pages.fileUpload.upload.saveError'))
        return h.redirect('/file-upload/upload')
      }

      const s3Key =
        fileInput.s3Key ??
        `file-uploads/${session.material}/${session.year}/${session.uploadId}/${fileInput.fileId}`

      try {
        await fileUploadApiService.createFileUpload({
          OrganisationId: user?.id ?? 'unknown',
          Material: session.material,
          YearOfAccreditation: Number(session.year),
          FileId: fileInput.fileId,
          Filename: fileInput.filename,
          ContentType: fileInput.contentType,
          S3Key: s3Key,
          S3Bucket: fileInput.s3Bucket ?? config.get('fileUpload.s3Bucket'),
          ScanStatus: scanStatus
        })
      } catch (err) {
        request.server.logger.error(`Error saving file upload: ${err.message}`)
        request.yar.flash('error', t('pages.fileUpload.upload.saveError'))
        return h.redirect('/file-upload/upload')
      }

      request.yar.clear(FILE_UPLOAD_SESSION_KEY)

      return h.redirect('/file-upload')
    }

    return h.view('file-upload/views/upload-status', {
      pageTitle: t('pages.fileUpload.status.title'),
      heading: t('pages.fileUpload.status.heading'),
      processingStatus: uploadStatus?.processingStatus ?? 'preprocessing'
    })
  }
}
