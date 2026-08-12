import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const REAL_SECRET = 'a'.repeat(48)

// config.js throws at module-load time when the guard trips, so each test
// must re-import it fresh with the relevant env vars set beforehand — a
// static top-of-file import would crash test collection for the whole file.
describe('redis boot guard', () => {
  const originalEnv = { ...process.env }

  // Helper: a production env with all earlier-gated checks (cookie secret,
  // stub auth, OAuth creds) satisfied so we can isolate the redis
  // hardening assertions.
  function setProdEnvWithOAuthDeps() {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.ENTRA_CLIENT_ID = 'azure-client-id'
    process.env.ENTRA_CLIENT_SECRET = 'azure-client-secret'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('production boot rejects an empty REDIS_HOST', async () => {
    setProdEnvWithOAuthDeps()
    delete process.env.REDIS_HOST
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    await expect(import('./config.js')).rejects.toThrow(/REDIS_HOST/)
  })

  test('production boot rejects REDIS_HOST=127.0.0.1', async () => {
    setProdEnvWithOAuthDeps()
    process.env.REDIS_HOST = '127.0.0.1'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    await expect(import('./config.js')).rejects.toThrow(/REDIS_HOST/)
  })

  test('production boot rejects REDIS_HOST=localhost', async () => {
    setProdEnvWithOAuthDeps()
    process.env.REDIS_HOST = 'localhost'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    await expect(import('./config.js')).rejects.toThrow(/REDIS_HOST/)
  })

  test('production boot rejects an empty REDIS_USERNAME', async () => {
    setProdEnvWithOAuthDeps()
    process.env.REDIS_HOST = 'redis.example.internal'
    delete process.env.REDIS_USERNAME
    process.env.REDIS_PASSWORD = 'redis-password'

    await expect(import('./config.js')).rejects.toThrow(/REDIS_USERNAME/)
  })

  test('production boot rejects an empty REDIS_PASSWORD', async () => {
    setProdEnvWithOAuthDeps()
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    delete process.env.REDIS_PASSWORD

    await expect(import('./config.js')).rejects.toThrow(/REDIS_PASSWORD/)
  })

  test('production boot succeeds with a routable REDIS_HOST and real credentials', async () => {
    setProdEnvWithOAuthDeps()
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    const mod = await import('./config.js')
    expect(mod.config.get('redis.host')).toBe('redis.example.internal')
  })

  test('REDIS_TLS=true enforces the guard even when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'local'
    delete process.env.SESSION_COOKIE_PASSWORD
    delete process.env.SESSION_COOKIE_SECURE
    delete process.env.AUTH_STUB_ENABLED
    process.env.REDIS_TLS = 'true'
    delete process.env.REDIS_HOST
    delete process.env.REDIS_USERNAME
    delete process.env.REDIS_PASSWORD

    await expect(import('./config.js')).rejects.toThrow(/REDIS_HOST/)
  })

  test('non-production boot without REDIS_TLS accepts the local redis defaults', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'local'
    delete process.env.SESSION_COOKIE_PASSWORD
    delete process.env.SESSION_COOKIE_SECURE
    delete process.env.AUTH_STUB_ENABLED
    delete process.env.REDIS_TLS
    delete process.env.REDIS_HOST
    delete process.env.REDIS_USERNAME
    delete process.env.REDIS_PASSWORD

    const mod = await import('./config.js')
    expect(mod.config.get('redis.host')).toBe('127.0.0.1')
    expect(mod.config.get('isProduction')).toBe(false)
  })
})
