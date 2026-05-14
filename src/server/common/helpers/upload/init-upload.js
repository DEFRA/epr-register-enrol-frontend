import { config } from '../../../../config/config.js'

export async function initUpload(options = {}) {
  const {
    redirect,
    callback,
    s3Bucket,
    s3Path,
    mimeTypes,
    maxFileSize,
    metadata
  } = options

  const baseUrl = new URL(config.get('fileUpload.cdpUploaderUrl'))
  const endpointUrl = new URL('/initiate', baseUrl).toString()
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redirect,
      callback,
      s3Bucket,
      s3Path,
      mimeTypes,
      maxFileSize,
      metadata
    })
  })

  if (!response.ok) {
    throw new Error(
      `CDP uploader initiate failed: ${response.status} ${response.statusText}`
    )
  }

  const result = await response.json()

  // The CDP uploader constructs uploadUrl/statusUrl using its Docker-internal
  // hostname. Rewrite both to use the configured host so the browser and
  // this server can reach them.
  const configured = new URL(endpointUrl)
  for (const field of ['uploadUrl', 'statusUrl']) {
    if (result[field]) {
      const parsed = new URL(result[field])
      parsed.protocol = configured.protocol
      parsed.hostname = configured.hostname
      parsed.port = configured.port
      result[field] = parsed.toString()
    }
  }

  return result
}
