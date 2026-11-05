import { statusCodes } from '../constants/status-codes.js'

// The backend answers 422 for several reasons (duplicate filename, disallowed
// content type), so the file cap is recognised by the error code in its
// problem+json body rather than by status or wording.
const MAX_FILES_API_ERROR_CODE = 'MaxFilesExceeded'

export function isMaxFilesRejection(err) {
  if (err.status !== statusCodes.unprocessableEntity) {
    return false
  }
  try {
    return JSON.parse(err.response)?.code === MAX_FILES_API_ERROR_CODE
  } catch {
    return false
  }
}
