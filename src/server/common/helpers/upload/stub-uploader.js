import { config } from '../../../../config/config.js'

const uploads = new Map()

export function stubInitiate({ metadata = {} } = {}) {
  const uploadId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const base = config.get('auth.callbackBaseUrl')
  const uploadUrl = `${base}/api/stub/cdp-upload/${uploadId}`
  const statusUrl = `${base}/api/stub/cdp-status/${uploadId}`
  uploads.set(uploadId, { metadata, status: 'initiated', fileInfo: null })
  return { uploadId, uploadUrl, statusUrl }
}

export function stubSetFile(uploadId, { filename, contentType }) {
  const upload = uploads.get(uploadId)
  if (!upload) return
  upload.fileInfo = {
    fileId: `stub-file-${Date.now()}`,
    filename,
    contentType,
    detectedContentType: contentType,
    fileStatus: 'complete',
    hasError: false,
    errorMessage: null
  }
  upload.status = 'ready'
}

export function stubGetStatus(uploadId) {
  const upload = uploads.get(uploadId)
  if (!upload) {
    return { uploadStatus: 'ready', metadata: {}, form: {} }
  }
  return {
    uploadStatus: upload.status === 'ready' ? 'ready' : 'pending',
    metadata: upload.metadata,
    form: upload.fileInfo ? { file: upload.fileInfo } : {}
  }
}
