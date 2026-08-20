import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const REAL_SECRET = 'a'.repeat(48)

// config.js throws at module-load time when the guard trips, so each test
// must re-import it fresh with the relevant env vars set beforehand — a
// static top-of-file import would crash test collection for the whole file.
describe('api stub enabled boot guard', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('production boot rejects API_STUB_ENABLED=true when ENVIRONMENT=prod', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.API_STUB_ENABLED = 'true'
    process.env.ENTRA_CLIENT_ID = 'azure-client-id'
    process.env.ENTRA_CLIENT_SECRET = 'azure-client-secret'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    await expect(import('./config.js')).rejects.toThrow(/API_STUB_ENABLED/)
  })

  test('production boot succeeds when ENVIRONMENT=prod and API_STUB_ENABLED=false', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.API_STUB_ENABLED = 'false'
    process.env.ENTRA_CLIENT_ID = 'azure-client-id'
    process.env.ENTRA_CLIENT_SECRET = 'azure-client-secret'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    const mod = await import('./config.js')
    expect(mod.config.get('api.stubEnabled')).toBe(false)
  })

  // Load-bearing regression test: deployed non-prod tiers (dev/test/ext-test)
  // legitimately run NODE_ENV=production with the API stub on before a real
  // backend is available. This must keep working — do not "strengthen" the
  // guard by adding an isProduction check, that would break this case.
  test('ENVIRONMENT=dev with API_STUB_ENABLED=true does not throw, even with NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'dev'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'true'
    process.env.API_STUB_ENABLED = 'true'
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    const mod = await import('./config.js')
    expect(mod.config.get('api.stubEnabled')).toBe(true)
    expect(mod.config.get('isProduction')).toBe(true)
  })
})
