import { apiClient } from '../../common/api-client.js'

const BASE = '/api/v1/file-uploads'

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
    return call(() =>
      apiClient.get(`${BASE}?organisationId=${encodeURIComponent(organisationId)}`)
    )
  },

  getFileUpload(fileUploadId) {
    return call(() => apiClient.get(`${BASE}/${fileUploadId}`))
  }
}
