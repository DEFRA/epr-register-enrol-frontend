import { apiClient } from '../../api-client.js'

export async function initUpload({
  initiateUrl,
  redirectUrl,
  s3Path,
  mimeTypes,
  maxFileSize,
  metadata
} = {}) {
  if (!initiateUrl) {
    throw new Error('initUpload: initiateUrl is required')
  }
  return apiClient.post(initiateUrl, {
    redirectUrl,
    s3Path,
    mimeTypes,
    maxFileSize,
    metadata
  })
}
