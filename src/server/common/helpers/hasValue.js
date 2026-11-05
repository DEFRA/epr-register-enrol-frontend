/**
 * Whether an answer has been given: a non-empty array, or anything other
 * than null, undefined or an empty string (so false and 0 count).
 */
export function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
}
