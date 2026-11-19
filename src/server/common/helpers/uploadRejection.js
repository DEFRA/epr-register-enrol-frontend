import { statusCodes } from '../constants/status-codes.js'

// The backend answers 422 for several reasons (duplicate filename, disallowed
// content type), so the file cap and (3bb.48) a duplicate filename are
// recognised by the error code in its problem+json body rather than by status
// or wording.
const REASON_BY_API_ERROR_CODE = {
  MaxFilesExceeded: 'maxFiles',
  DuplicateFilename: 'duplicateFilename'
}

export const UPLOAD_REJECTION_REASONS = Object.freeze({
  maxFiles: 'maxFiles',
  duplicateFilename: 'duplicateFilename'
})

export function uploadRejectionReason(err) {
  if (err?.status !== statusCodes.unprocessableEntity) {
    return null
  }
  try {
    const code = JSON.parse(err.response)?.code
    return Object.hasOwn(REASON_BY_API_ERROR_CODE, code)
      ? REASON_BY_API_ERROR_CODE[code]
      : null
  } catch {
    return null
  }
}
