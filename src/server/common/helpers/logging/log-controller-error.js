/**
 * Shared shape for a controller/helper catch-block error log: structured
 * context fields plus the error under pino's standard `err` key, with a
 * static human-readable message. Collapses the repeated
 * `logger.error({ ...context, err }, message)` call that appeared
 * near-identically across ~20 controllers into one call site.
 */
export function logControllerError(logger, err, context, message) {
  logger.error({ ...context, err }, message)
}
