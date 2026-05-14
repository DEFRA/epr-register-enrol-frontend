import { Readable } from 'node:stream'
import { config } from '../../../config/config.js'
import { fileUploadApiService } from '../helpers/file-upload-api-service.js'

export const fileDownloadController = {
  async handler(request, h) {
    const { fileUploadId } = request.params

    let file
    try {
      file = await fileUploadApiService.getFileUpload(fileUploadId)
    } catch (err) {
      return h.response('File not found').code(404)
    }

    if (file.scanStatus !== 'Clean') {
      return h.response('File is not available for download').code(422)
    }

    const s3Endpoint = config.get('fileUpload.s3Endpoint')
    const s3Bucket = config.get('fileUpload.s3Bucket')
    const fileUrl = `${s3Endpoint}/${s3Bucket}/${file.s3Key}`

    const s3Response = await fetch(fileUrl)

    if (!s3Response.ok) {
      return h.response('File not found in storage').code(404)
    }

    const filename = encodeURIComponent(file.filename)

    return h
      .response(Readable.fromWeb(s3Response.body))
      .header('Content-Type', file.contentType)
      .header(
        'Content-Disposition',
        `attachment; filename="${file.filename}"; filename*=UTF-8''${filename}`
      )
  }
}
