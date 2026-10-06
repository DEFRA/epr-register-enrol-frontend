export const PLACEHOLDER_SESSION_COOKIE_PASSWORD =
  'the-password-must-be-at-least-32-characters-long'

/**
 * Refuses to boot on config that is valid to convict but unsafe to deploy.
 * Must run after config.validate(), since every check reads validated values.
 */
export function assertSafeBootConfig(config) {
  // Production hardening: refuse to boot with stub auth enabled when
  // ENVIRONMENT=prod. The stub auth provider auto-authenticates every
  // request as a fixed test user and bypasses real OAuth — it must never
  // be reachable in the real production tier. Gated on the validated
  // `environment` enum, not NODE_ENV/isProduction: deployed non-prod tiers
  // (dev/test/ext-test) legitimately run with NODE_ENV=production and
  // AUTH_STUB_ENABLED=true, and that must keep working.
  if (config.get('environment') === 'prod' && config.get('auth.stubEnabled')) {
    throw new Error(
      'AUTH_STUB_ENABLED must be false when ENVIRONMENT=prod. The stub auth ' +
        'provider bypasses real OAuth and auto-authenticates every request.'
    )
  }

  // Production hardening: refuse to boot with the placeholder session
  // cookie password. convict only validates length, not that the operator
  // supplied a unique secret — a missing SESSION_COOKIE_PASSWORD in a
  // deployed env would silently fall back to this publicly known default,
  // signing/encrypting session data with a key anyone can read on GitHub.
  const sessionCookieSecure = config.get('session.cookie.secure')
  const sessionCookiePassword = config.get('session.cookie.password')

  if (
    (config.get('isProduction') || sessionCookieSecure) &&
    sessionCookiePassword === PLACEHOLDER_SESSION_COOKIE_PASSWORD
  ) {
    throw new Error(
      'SESSION_COOKIE_PASSWORD must be set to a unique per-environment secret ' +
        '(>=32 chars) via Secrets Manager. The placeholder default is not ' +
        'permitted when SESSION_COOKIE_SECURE is true or NODE_ENV=production.'
    )
  }

  // Production hardening: when real OAuth is in use (production with stub
  // disabled) both the Azure Entra ID (regulator login) and Defra ID
  // (operator login) credentials must be supplied. The convict defaults are
  // empty strings so dev/test work without secrets; an empty value reaching
  // production means missing Secrets Manager wiring and would fail opaquely
  // on first login. Fail loudly at boot instead.
  if (config.get('isProduction') && !config.get('auth.stubEnabled')) {
    if (!config.get('auth.azureEntraId.clientId')) {
      throw new Error(
        'ENTRA_CLIENT_ID (auth.azureEntraId.clientId) must be set in ' +
          'production when AUTH_STUB_ENABLED is false. Wire the value via ' +
          'Secrets Manager.'
      )
    }
    if (!config.get('auth.azureEntraId.clientSecret')) {
      throw new Error(
        'ENTRA_CLIENT_SECRET (auth.azureEntraId.clientSecret) must be set ' +
          'in production when AUTH_STUB_ENABLED is false. Wire the value ' +
          'via Secrets Manager.'
      )
    }
    if (!config.get('auth.defraId.clientId')) {
      throw new Error(
        'DEFRA_ID_CLIENT_ID (auth.defraId.clientId) must be set in ' +
          'production when AUTH_STUB_ENABLED is false. Wire the value via ' +
          'Secrets Manager.'
      )
    }
    if (!config.get('auth.defraId.clientSecret')) {
      throw new Error(
        'DEFRA_ID_CLIENT_SECRET (auth.defraId.clientSecret) must be set in ' +
          'production when AUTH_STUB_ENABLED is false. Wire the value via ' +
          'Secrets Manager.'
      )
    }
    if (!config.get('auth.defraId.discoveryUrl')) {
      throw new Error(
        'DEFRA_ID_DISCOVERY_URL (auth.defraId.discoveryUrl) must be set in ' +
          'production when AUTH_STUB_ENABLED is false. Wire the value via ' +
          'Secrets Manager.'
      )
    }
  }

  // Production hardening: convict defaults target local dev (host=127.0.0.1,
  // empty username/password). In a deployed env the cache must point at
  // Elasticache over TLS with real credentials. Fail loudly at boot whenever
  // production OR TLS is active, rather than let the redis client silently
  // connect without auth.
  const redisUseTLS = config.get('redis.useTLS')
  if (config.get('isProduction') || redisUseTLS) {
    const redisHost = config.get('redis.host')
    if (!redisHost || redisHost === 'localhost' || redisHost === '127.0.0.1') {
      throw new Error(
        'REDIS_HOST (redis.host) must be set to a routable Elasticache ' +
          'endpoint in production or when REDIS_TLS is true. Localhost / ' +
          '127.0.0.1 / empty values are not permitted.'
      )
    }
    if (!config.get('redis.username')) {
      throw new Error(
        'REDIS_USERNAME (redis.username) must be set in production or when ' +
          'REDIS_TLS is true. Wire the value via Secrets Manager.'
      )
    }
    if (!config.get('redis.password')) {
      throw new Error(
        'REDIS_PASSWORD (redis.password) must be set in production or when ' +
          'REDIS_TLS is true. Wire the value via Secrets Manager.'
      )
    }
  }

  // Production hardening: refuse to boot with the stub API client enabled
  // when ENVIRONMENT=prod. The stub client never calls the real backend —
  // every accreditation/case-working request would be served fake data
  // instead of failing loudly. Same `environment`-gated pattern as the
  // AUTH_STUB_ENABLED guard above: deployed non-prod tiers legitimately run
  // with API_STUB_ENABLED=true while a backend isn't available yet.
  if (config.get('environment') === 'prod' && config.get('api.stubEnabled')) {
    throw new Error(
      'API_STUB_ENABLED must be false when ENVIRONMENT=prod. The stub API ' +
        'client never contacts the real backend and serves fake data instead.'
    )
  }
}
