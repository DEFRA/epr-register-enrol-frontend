import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000
const twentyMinutesMs = 1200000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

export const PLACEHOLDER_SESSION_COOKIE_PASSWORD =
  'the-password-must-be-at-least-32-characters-long'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'epr-register-enrol-frontend'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    idleTimeoutMs: {
      doc: 'Idle-inactivity timeout in milliseconds. Applies alongside the absolute session.cache.ttl/session.cookie.ttl - whichever is reached first ends the session (RA-461).',
      format: Number,
      default: twentyMinutesMs,
      env: 'SESSION_IDLE_TIMEOUT'
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'epr-register-enrol-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  environment: {
    doc: 'Deployment environment name',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  auth: {
    stubEnabled: {
      // Reads process.env directly rather than the validated `environment`
      // key above: convict builds this schema as a single object literal, so
      // `environment` isn't materialized into a queryable config yet at this
      // point — config.get('environment') doesn't exist until after convict()
      // returns. This only affects the *default* though; enforcement (below,
      // after config.validate()) reads both values via config.get(), fully
      // validated.
      doc: 'Enable stub auth (bypasses real OAuth). Defaults true for non-prod.',
      format: Boolean,
      default: process.env.ENVIRONMENT !== 'prod',
      env: 'AUTH_STUB_ENABLED'
    },
    basicEnabled: {
      doc: 'Enable HTTP basic authentication. Defaults to false. Requires BASIC_USER and BASIC_PASSWD to be set — basic-auth-plugin.js throws at server registration if either is empty when this is enabled (not enforced here in config.js).',
      format: Boolean,
      default: false,
      env: 'AUTH_BASIC_ENABLED'
    },
    basicUsr: {
      doc: 'The username for HTTP basic authentication. Must be non-empty when AUTH_BASIC_ENABLED is true.',
      format: String,
      default: '',
      env: 'BASIC_USER'
    },
    basicPasswd: {
      doc: 'The password for HTTP basic authentication. Must be non-empty when AUTH_BASIC_ENABLED is true.',
      format: String,
      default: '',
      env: 'BASIC_PASSWD',
      sensitive: true
    },
    azureEntraId: {
      clientId: {
        format: String,
        default: '',
        env: 'ENTRA_CLIENT_ID',
        sensitive: true
      },
      clientSecret: {
        format: String,
        default: '',
        env: 'ENTRA_CLIENT_SECRET',
        sensitive: true
      },
      tenantId: {
        format: String,
        default: '',
        env: 'ENTRA_TENANT_ID'
      },
      regulatorRoleValue: {
        doc: 'RA-429. Entra ID app role a signed-in user must hold to be treated as a regulator.',
        format: String,
        default: 'Waste.Regulator.Standard',
        env: 'ENTRA_REGULATOR_ROLE_VALUE'
      },
      supportUserRoleValue: {
        doc: 'RA-429. Entra ID app role a signed-in user must hold to be treated as a read-only support user.',
        format: String,
        default: 'Waste.SupportUser.ReadOnly',
        env: 'ENTRA_SUPPORT_USER_ROLE_VALUE'
      }
    },
    defraId: {
      clientId: {
        format: String,
        default: '',
        env: 'DEFRA_ID_CLIENT_ID',
        sensitive: true
      },
      clientSecret: {
        format: String,
        default: '',
        env: 'DEFRA_ID_CLIENT_SECRET',
        sensitive: true
      },
      discoveryUrl: {
        doc: 'Full OIDC metadata URL for Defra ID — used to discover authorization_endpoint and token_endpoint',
        format: String,
        default: '',
        env: 'DEFRA_ID_DISCOVERY_URL'
      },
      serviceId: {
        doc: 'Defra ID service ID provided during onboarding',
        format: String,
        default: '',
        env: 'DEFRA_ID_SERVICE_ID'
      }
    },
    callbackBaseUrl: {
      doc: 'Base URL for OAuth callback URLs (e.g. https://myapp.example.com)',
      format: String,
      default: 'http://localhost:3000',
      env: 'AUTH_CALLBACK_BASE_URL'
    }
  },
  fileUpload: {
    s3Bucket: {
      doc: 'CDP-provisioned S3 bucket that uploaded files are stored in',
      format: String,
      default: 'epr-register-enrol-file-uploads',
      env: 'FILE_UPLOAD_S3_BUCKET'
    }
  },
  api: {
    stubEnabled: {
      doc: 'Use stub API client instead of real API (for local dev without a running backend)',
      format: Boolean,
      default: true,
      env: 'API_STUB_ENABLED'
    },
    baseUrl: {
      doc: 'Base URL for external API',
      format: String,
      default: 'http://localhost:5000',
      env: 'API_BASE_URL'
    },
    timeout: {
      doc: 'API request timeout in milliseconds',
      format: Number,
      default: 5000,
      env: 'API_TIMEOUT'
    },
    // Flat CDP secrets naming convention (not nested under `api`, matching
    // AUTH_SHARED_SECRET__MANAGEMENT_BE etc on the backend) — must match
    // AUTH_SHARED_SECRET__FRONTEND on epr-register-enrol-backend exactly.
    sharedSecret: {
      doc: 'Shared secret sent as a Bearer token on outbound backend calls',
      format: String,
      default: '',
      env: 'AUTH_SHARED_SECRET__BACKEND',
      sensitive: true
    }
  },
  reex: {
    orgDefraLinkCacheTtl: {
      doc: "How long (ms) to cache an organisation's linked Defra organisation id from ReEx before re-fetching. Used by the operator accreditation authorisation check.",
      format: Number,
      default: 3600000,
      env: 'REEX_ORG_DEFRA_LINK_CACHE_TTL'
    },
    frontendBaseUrl: {
      doc: 'Base URL of the Re-Ex frontend service (e.g. https://epr-frontend.dev.cdp-int.defra.cloud). Used to build the "Return to Re/Ex service" link from the operator accreditation page when AUTH_STUB_ENABLED is false and ENVIRONMENT is not local.',
      format: String,
      default: '',
      env: 'REEX_FRONTEND_BASE_URL'
    }
  },
  regulatorQuery: {
    textDisabled: {
      doc: 'RA-439. Kill switch that hides the regulator-query banner (heading, summary, officer free-text queryNote, fields-to-update list) on queried section pages. Display-only — has no effect on applicationStatus/sectionStatus, read-only/blocked access, or CM/backend data.',
      format: Boolean,
      default: false,
      env: 'REGULATOR_QUERY_TEXT_DISABLED'
    }
  }
})

config.validate({ allowed: 'strict' })

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
