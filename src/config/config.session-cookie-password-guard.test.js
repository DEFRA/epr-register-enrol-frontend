import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const PLACEHOLDER = 'the-password-must-be-at-least-32-characters-long'
const REAL_SECRET = 'a'.repeat(48)

// config.js throws at module-load time when the guard trips, so each test
// must re-import it fresh with the relevant env vars set beforehand — a
// static top-of-file import would crash test collection for the whole file.
describe('session cookie password boot guard', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('production boot rejects the placeholder SESSION_COOKIE_PASSWORD', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.AUTH_STUB_ENABLED = 'false'
    delete process.env.SESSION_COOKIE_PASSWORD

    await expect(import('./config.js')).rejects.toThrow(
      /SESSION_COOKIE_PASSWORD/
    )
  })

  test('non-prod boot accepts the placeholder SESSION_COOKIE_PASSWORD', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'local'
    delete process.env.SESSION_COOKIE_PASSWORD
    delete process.env.SESSION_COOKIE_SECURE

    const mod = await import('./config.js')
    expect(mod.config.get('session.cookie.password')).toBe(PLACEHOLDER)
    expect(mod.config.get('isProduction')).toBe(false)
  })

  test('SESSION_COOKIE_SECURE=true rejects the placeholder even when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'local'
    process.env.SESSION_COOKIE_SECURE = 'true'
    delete process.env.SESSION_COOKIE_PASSWORD

    await expect(import('./config.js')).rejects.toThrow(
      /SESSION_COOKIE_PASSWORD/
    )
  })

  test('production boot succeeds when a real SESSION_COOKIE_PASSWORD is set', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.ENTRA_CLIENT_ID = 'azure-client-id'
    process.env.ENTRA_CLIENT_SECRET = 'azure-client-secret'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    const mod = await import('./config.js')
    expect(mod.config.get('session.cookie.password')).toBe(REAL_SECRET)
  })
})
