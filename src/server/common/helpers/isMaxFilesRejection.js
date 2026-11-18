import { statusCodes } from '../constants/status-codes.js'

// The backend answers 422 for several reasons (duplicate filename, disallowed
// content type), so the file cap and (3bb.48) a duplicate filename are
// recognised by the error code in its problem+json body rather than by status
// or wording.
const MAX_FILES_API_ERROR_CODE = 'MaxFilesExceeded'
const DUPLICATE_FILENAME_API_ERROR_CODE = 'DuplicateFilename'

function rejectionCode(err) {
  if (err.status !== statusCodes.unprocessableEntity) {
    return undefined
  }
  try {
    return JSON.parse(err.response)?.code
  } catch {
    return undefined
  }
}

export function isMaxFilesRejection(err) {
  return rejectionCode(err) === MAX_FILES_API_ERROR_CODE
}

export function isDuplicateFilenameRejection(err) {
  return rejectionCode(err) === DUPLICATE_FILENAME_API_ERROR_CODE
}
