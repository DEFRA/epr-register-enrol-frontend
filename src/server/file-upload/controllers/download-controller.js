import { apiClient } from '../../common/api-client.js'

export const fileDownloadController = {
  async handler(request, h) {
    const { fileUploadId } = request.params

    let downloadData
    try {
      downloadData = await apiClient.get(
        `/api/v1/file-uploads/${fileUploadId}/download`
      )
    } catch (err) {
      if (err.output?.statusCode === 404) {
        return h.response('File not found').code(404)
      }
      if (err.output?.statusCode === 422) {
        return h.response('File is not available for download').code(422)
      }
      return h.response('File not found').code(404)
    }

    return h.redirect(downloadData.presignedUrl)
  }
}
