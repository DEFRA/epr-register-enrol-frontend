export const PLACEHOLDER_SESSION_COOKIE_PASSWORD =
  'the-password-must-be-at-least-32-characters-long'

const LOCAL_REDIS_HOSTS = new Set(['localhost', '127.0.0.1'])

const OAUTH_CREDENTIALS = [
  ['auth.defraId.clientId', 'DEFRA_ID_CLIENT_ID'],
  ['auth.defraId.clientSecret', 'DEFRA_ID_CLIENT_SECRET'],
  ['auth.defraId.discoveryUrl', 'DEFRA_ID_DISCOVERY_URL']
]

const REDIS_CREDENTIALS = [
  ['redis.username', 'REDIS_USERNAME'],
  ['redis.password', 'REDIS_PASSWORD']
]

function assertSet(config, [key, envName], when) {
  if (!config.get(key)) {
    throw new Error(
      `${envName} (${key}) must be set ${when}. Wire the value via Secrets Manager.`
    )
  }
}

// The stub auth provider auto-authenticates every request as a fixed test
// user and bypasses real OAuth. Gated on the validated `environment` enum, not
// NODE_ENV/isProduction: deployed non-prod tiers (dev/test/ext-test)
// legitimately run with NODE_ENV=production and AUTH_STUB_ENABLED=true.
function assertNoStubAuthInProd(config) {
  if (config.get('environment') === 'prod' && config.get('auth.stubEnabled')) {
    throw new Error(
      'AUTH_STUB_ENABLED must be false when ENVIRONMENT=prod. The stub auth ' +
        'provider bypasses real OAuth and auto-authenticates every request.'
    )
  }
}

// convict only validates length, not that a unique secret was supplied — a
// missing SESSION_COOKIE_PASSWORD in a deployed env would silently fall back
// to this publicly known default, signing session data with a key anyone can
// read on GitHub.
function assertSessionCookiePasswordIsSecret(config) {
  const mustBeSecret =
    config.get('isProduction') || config.get('session.cookie.secure')

  if (
    mustBeSecret &&
    config.get('session.cookie.password') ===
      PLACEHOLDER_SESSION_COOKIE_PASSWORD
  ) {
    throw new Error(
      'SESSION_COOKIE_PASSWORD must be set to a unique per-environment secret ' +
        '(>=32 chars) via Secrets Manager. The placeholder default is not ' +
        'permitted when SESSION_COOKIE_SECURE is true or NODE_ENV=production.'
    )
  }
}

// The convict defaults are empty strings so dev/test work without secrets; an
// empty value reaching production means missing Secrets Manager wiring and
// would fail opaquely on first login.
function assertOAuthCredentialsSet(config) {
  if (!config.get('isProduction') || config.get('auth.stubEnabled')) {
    return
  }

  for (const credential of OAUTH_CREDENTIALS) {
    assertSet(
      config,
      credential,
      'in production when AUTH_STUB_ENABLED is false'
    )
  }
}

// convict defaults target local dev (host=127.0.0.1, no credentials). In a
// deployed env the cache must be Elasticache over TLS with real credentials,
// not a redis client silently connecting without auth.
function assertRedisIsDeployable(config) {
  if (!config.get('isProduction') && !config.get('redis.useTLS')) {
    return
  }

  const redisHost = config.get('redis.host')
  if (!redisHost || LOCAL_REDIS_HOSTS.has(redisHost)) {
    throw new Error(
      'REDIS_HOST (redis.host) must be set to a routable Elasticache ' +
        'endpoint in production or when REDIS_TLS is true. Localhost / ' +
        '127.0.0.1 / empty values are not permitted.'
    )
  }

  for (const credential of REDIS_CREDENTIALS) {
    assertSet(config, credential, 'in production or when REDIS_TLS is true')
  }
}

// The stub client never calls the real backend, so every request would be
// served fake data instead of failing loudly. Same `environment` gating as
// assertNoStubAuthInProd, for the same reason.
function assertNoStubApiInProd(config) {
  if (config.get('environment') === 'prod' && config.get('api.stubEnabled')) {
    throw new Error(
      'API_STUB_ENABLED must be false when ENVIRONMENT=prod. The stub API ' +
        'client never contacts the real backend and serves fake data instead.'
    )
  }
}

/**
 * Refuses to boot on config that is valid to convict but unsafe to deploy.
 * Must run after config.validate(), since every check reads validated values.
 */
export function assertSafeBootConfig(config) {
  assertNoStubAuthInProd(config)
  assertSessionCookiePasswordIsSecret(config)
  assertOAuthCredentialsSet(config)
  assertRedisIsDeployable(config)
  assertNoStubApiInProd(config)
}
