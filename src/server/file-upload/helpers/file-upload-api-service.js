import { realApiClient as apiClient } from '../../common/api-client.js'

const BASE = '/api/v1/file-uploads'

function normalizeFileUpload(file) {
  return {
    fileUploadId: file.fileUploadId,
    organisationId: file.organisationId,
    material: file.material,
    yearOfAccreditation: file.yearOfAccreditation,
    fileId: file.fileId,
    filename: file.filename,
    contentType: file.contentType,
    s3Key: file.s3Key,
    scanStatus: file.scanStatus,
    uploadedAt: file.uploadedAt
  }
}

function normaliseError(err) {
  const status = err.status ?? 500
  const message = err.message ?? 'Unknown error'
  const normalised = new Error(message)
  normalised.status = status
  normalised.isApiError = true
  return normalised
}

async function call(fn) {
  try {
    return await fn()
  } catch (err) {
    throw normaliseError(err)
  }
}

export const fileUploadApiService = {
  createFileUpload(body) {
    return call(() => apiClient.post(BASE, body))
  },

  listFileUploads(organisationId) {
    return call(async () => {
      const files = await apiClient.get(
        `${BASE}?organisationId=${encodeURIComponent(organisationId)}`
      )
      return files.map(normalizeFileUpload)
    })
  },

  getFileUpload(fileUploadId) {
    return call(async () => {
      const file = await apiClient.get(`${BASE}/${fileUploadId}`)
      return normalizeFileUpload(file)
    })
  }
}
