import { statusCodes } from '../../constants/status-codes.js'

// RA-620: a 400 from an overseas or interim site save means the backend's
// validator rejected something the wizard let through. Its response body
// lists the failing fields, but the ECS formatter only keeps an error's
// message, type and stack, so the body never reached the logs and the two
// production instances could not be diagnosed. This returns the part worth
// keeping, for the log message itself (the field CDP always indexes).
//
// Never includes a submitted value: the backend's FluentValidation failures
// carry them in `attemptedValue` (contact name, email, phone), which is
// dropped here, and the payload summary records only each field's shape.

function summariseValue(value) {
  if (value == null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return `${value.length} items`
  }
  if (typeof value === 'string') {
    return value.length === 0 ? 'empty' : `${value.length} chars`
  }
  return typeof value
}

export function summarisePayloadShape(payload) {
  return Object.entries(payload ?? {})
    .map(([field, value]) => `${field}: ${summariseValue(value)}`)
    .join(', ')
}

function parseFailures(responseBody) {
  try {
    const parsed = JSON.parse(responseBody)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function describeFailure({ propertyName, errorCode, errorMessage }) {
  return `${propertyName} (${errorCode}: ${errorMessage})`
}

/**
 * @param {Error & {status?: number, response?: string}} err - as thrown by api-client
 * @param {object} payload - the body that was sent
 * @returns {string} a suffix for the log message, or '' when err is not a 400
 */
export function describeSiteSaveValidationError(err, payload) {
  if (err?.status !== statusCodes.badRequest) {
    return ''
  }
  const failures = parseFailures(err.response)
  const fields = failures
    ? failures.map(describeFailure).join('; ')
    : 'response body was not a validation failure list'
  return ` - validation failed: ${fields} - payload: ${summarisePayloadShape(payload)}`
}
