export const REDACTED_VALUE = '[REDACTED]'

/**
 * Wraps pino's standard request serializer output and redacts the client IP.
 * hapi-pino passes the already-std-serialized req object here (it wraps
 * whatever we register as `serializers.req` with `wrapRequestSerializer`),
 * so `req.remoteAddress` is a plain string at this point, not a connection.
 */
export function redactedReqSerializer(req) {
  return {
    ...req,
    remoteAddress: REDACTED_VALUE
  }
}

// Registered by key so any future `logger.info({ email }, ...)` call site
// has its email value redacted automatically. No equivalent for personal
// name: this codebase has no current call site logging one, and a blanket
// "name" serializer would also redact business/organisation name fields.
export const piiSerializers = {
  req: redactedReqSerializer,
  email: () => REDACTED_VALUE
}
