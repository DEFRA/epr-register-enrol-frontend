export const REDACTED_VALUE = '[REDACTED]'

// Matches an email address anywhere within a string (e.g. one echoed back
// inside a raw downstream-API error response body), not just a value that
// is itself nothing but an email address. Deliberately simple (no
// requirement for a dotted TLD) rather than a full RFC 5322 pattern: this
// is a defensive redaction scan over arbitrary text, not validation.
// SonarCloud (javascript:S8786) flags any regex with more than one
// unbounded quantifier as a potential super-linear-backtracking risk,
// regardless of whether the quantified classes actually overlap - so
// beyond excluding "@"/whitespace/wrapping punctuation from both sides
// (removing any real ambiguity), both quantifiers are also explicitly
// bounded to RFC 5321's own length limits (64 chars for the local part,
// 255 for the domain), so the search space is provably finite no matter
// what static analysis assumes about the pattern shape.
const EMAIL_PATTERN = /[^\s@"'<>,;)}\]]{1,64}@[^\s@"'<>,;)}\]]{1,255}/g

/**
 * Redacts any email address embedded in a string. Used at the point a raw
 * value (e.g. a downstream API's error response body) is first captured,
 * so every place that later logs it - including plain string
 * interpolation, which no pino serializer can see - gets the safe version.
 */
export function redactEmailAddresses(text) {
  if (typeof text !== 'string') {
    return text
  }
  return text.replace(EMAIL_PATTERN, REDACTED_VALUE)
}

// Header names that can carry the real client IP when the app sits behind
// a reverse proxy/load balancer (this platform's local dev stack fronts
// every service with nginx-proxy, which sets these by default) - the
// process-level remoteAddress is then just the proxy's own address, so
// these headers are the field that actually needs redacting.
const FORWARDED_IP_HEADERS = ['x-forwarded-for', 'x-real-ip']

function redactForwardedIpHeaders(headers) {
  if (headers == null) {
    return headers
  }
  const redacted = { ...headers }
  for (const header of FORWARDED_IP_HEADERS) {
    if (header in redacted) {
      redacted[header] = REDACTED_VALUE
    }
  }
  return redacted
}

/**
 * Wraps pino's standard request serializer output and redacts the client IP.
 * hapi-pino passes the already-std-serialized req object here (it wraps
 * whatever we register as `serializers.req` with `wrapRequestSerializer`),
 * so `req.remoteAddress` is a plain string at this point, not a connection.
 *
 * This guarantee only holds via the hapi-pino-wrapped path (registered in
 * request-logger.js). The bare `pino(loggerOptions)` instance exported by
 * logger.js's `createLogger()` does NOT get this wrapping, so a future
 * `createLogger().info({ req: rawRequest }, ...)` call would receive an
 * unserialized req and this function's redaction couldn't be relied on
 * for it. No current call site does this.
 */
export function redactedReqSerializer(req) {
  return {
    ...req,
    remoteAddress: REDACTED_VALUE,
    headers: redactForwardedIpHeaders(req.headers)
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
