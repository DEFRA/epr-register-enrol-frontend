import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'
import { authSchema } from './auth-schema.js'
import {
  assertSafeBootConfig,
  PLACEHOLDER_SESSION_COOKIE_PASSWORD
} from './boot-guards.js'
import { featureFlagsSchema } from './feature-flags.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000
const twentyMinutesMs = 1200000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

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
    // RA-487: matches the Re-Ex frontend's own service name verbatim — the
    // top nav is meant to present as one continuous service regardless of
    // which of the two apps a user is actually on.
    doc: 'Applications Service Name',
    format: String,
    default: 'Record reprocessed or exported packaging waste'
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
  featureFlags: featureFlagsSchema,
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
    concurrentLoginNotice: {
      enabled: {
        doc: 'RA-462 kill switch for the concurrent-login notification. When false, no new-sign-in toast is shown; logins are still recorded so it can be switched back on without a gap.',
        format: Boolean,
        default: true,
        env: 'SESSION_CONCURRENT_LOGIN_NOTICE_ENABLED'
      }
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
        default: PLACEHOLDER_SESSION_COOKIE_PASSWORD,
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
  auth: authSchema,
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
      doc: 'RA-459. Base URL of the Re-Ex frontend service (e.g. https://epr-frontend.dev.cdp-int.defra.cloud). Used to build the "Back" link from the operator accreditation page when AUTH_STUB_ENABLED is false and ENVIRONMENT is not local, and unconditionally as the fallback destination wherever the app would otherwise send an operator back to the test-only /operator page. Should be set per-environment (see .env.example) rather than left blank — the empty default here exists only because a value cannot be hardcoded in source.',
      format: String,
      default: '',
      env: 'REEX_FRONTEND_BASE_URL'
    }
  },
  regulatorQuery: {
    textDisabled: {
      doc: 'RA-439. Kill switch that hides the regulator-query banner (heading, summary, fields-to-update list) on queried section pages. RA-590 removed the officer free-text note from this banner, so the switch no longer governs any officer-authored text. Display-only — has no effect on applicationStatus/sectionStatus, read-only/blocked access, or CM/backend data.',
      format: Boolean,
      default: false,
      env: 'REGULATOR_QUERY_TEXT_DISABLED'
    }
  },
  testPages: {
    disabled: {
      doc: 'RA-459. Kill switch for the placeholder "/" home page and "/operator" landing page — neither is wired to any real application context (no site/material selected) and both should not be reachable in the integrated environment. When true, both 404 rather than rendering.',
      format: Boolean,
      default: false,
      env: 'TEST_PAGES_DISABLED'
    }
  },
  analytics: {
    isEnabled: {
      doc: 'Show the analytics cookie banner and allow analytics. Only takes effect alongside a measurement id.',
      format: Boolean,
      default: false,
      env: 'ANALYTICS_ENABLED'
    },
    measurementId: {
      doc: 'GA4 measurement id of the analytics property to report to.',
      format: String,
      default: '',
      env: 'ANALYTICS_MEASUREMENT_ID'
    }
  }
})

config.validate({ allowed: 'strict' })
assertSafeBootConfig(config)
