import { config } from '../../../../config/config.js'

export async function fetchStatus(uploadId) {
  const endpointUrl =
    config.get('fileUpload.cdpUploaderUrl') + `/status/${uploadId}`

  const response = await fetch(endpointUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(
      `CDP uploader status check failed: ${response.status} ${response.statusText}`
    )
  }

  return await response.json()
}
