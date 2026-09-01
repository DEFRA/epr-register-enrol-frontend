/**
 * Shared shape for a catch-block error log (controller handlers and plain
 * helpers alike): structured context fields plus the error under pino's
 * standard `err` key, with a static human-readable message. Collapses the
 * repeated `logger.error({ ...context, err }, message)` call that appeared
 * near-identically across ~20 call sites into one place.
 */
export function logStructuredError(logger, err, context, message) {
  logger.error({ ...context, err }, message)
}
