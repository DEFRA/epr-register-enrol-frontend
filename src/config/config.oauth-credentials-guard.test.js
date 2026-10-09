import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const REAL_SECRET = 'a'.repeat(48)

// config.js throws at module-load time when the guard trips, so each test
// must re-import it fresh with the relevant env vars set beforehand — a
// static top-of-file import would crash test collection for the whole file.
describe('OAuth credentials boot guard', () => {
  const originalEnv = { ...process.env }

  function setProdWithRedisDeps() {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('production boot rejects empty DEFRA_ID_CLIENT_ID when stub auth disabled', async () => {
    setProdWithRedisDeps()
    process.env.AUTH_STUB_ENABLED = 'false'
    delete process.env.DEFRA_ID_CLIENT_ID
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'

    await expect(import('./config.js')).rejects.toThrow(/DEFRA_ID_CLIENT_ID/)
  })

  test('production boot rejects empty DEFRA_ID_CLIENT_SECRET when stub auth disabled', async () => {
    setProdWithRedisDeps()
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    delete process.env.DEFRA_ID_CLIENT_SECRET
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'

    await expect(import('./config.js')).rejects.toThrow(
      /DEFRA_ID_CLIENT_SECRET/
    )
  })

  test('production boot rejects empty DEFRA_ID_DISCOVERY_URL when stub auth disabled', async () => {
    setProdWithRedisDeps()
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    delete process.env.DEFRA_ID_DISCOVERY_URL

    await expect(import('./config.js')).rejects.toThrow(
      /DEFRA_ID_DISCOVERY_URL/
    )
  })

  test('production boot succeeds when all Defra ID credentials are set', async () => {
    setProdWithRedisDeps()
    process.env.AUTH_STUB_ENABLED = 'false'
    process.env.API_STUB_ENABLED = 'false'
    process.env.DEFRA_ID_CLIENT_ID = 'defra-id-client-id'
    process.env.DEFRA_ID_CLIENT_SECRET = 'defra-id-client-secret'
    process.env.DEFRA_ID_DISCOVERY_URL = 'https://defra-id.example/.well-known'

    const mod = await import('./config.js')
    expect(mod.config.get('auth.defraId.clientId')).toBe('defra-id-client-id')
  })

  // Proves the guard is gated on !stubEnabled, not on isProduction alone.
  test('OAuth credentials are not required when AUTH_STUB_ENABLED=true in a deployed non-prod environment', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'dev'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'true'
    delete process.env.DEFRA_ID_CLIENT_ID
    delete process.env.DEFRA_ID_CLIENT_SECRET
    delete process.env.DEFRA_ID_DISCOVERY_URL
    process.env.REDIS_HOST = 'redis.example.internal'
    process.env.REDIS_USERNAME = 'redis-user'
    process.env.REDIS_PASSWORD = 'redis-password'

    const mod = await import('./config.js')
    expect(mod.config.get('auth.stubEnabled')).toBe(true)
  })

  test('non-production boot accepts empty OAuth credentials', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'local'
    delete process.env.SESSION_COOKIE_PASSWORD
    delete process.env.SESSION_COOKIE_SECURE
    delete process.env.AUTH_STUB_ENABLED
    delete process.env.DEFRA_ID_CLIENT_ID
    delete process.env.DEFRA_ID_CLIENT_SECRET
    delete process.env.DEFRA_ID_DISCOVERY_URL

    const mod = await import('./config.js')
    expect(mod.config.get('isProduction')).toBe(false)
    expect(mod.config.get('auth.defraId.clientId')).toBe('')
  })

  // RA-537: regulator sign-in (Azure Entra ID) and its RA-427 kill switch were
  // removed — the schema keys must be gone, not just left unread.
  test('has no Entra ID or regulator-access config keys', async () => {
    const mod = await import('./config.js')
    expect(() => mod.config.get('auth.azureEntraId')).toThrow()
    expect(() => mod.config.get('auth.regulatorAccessDisabled')).toThrow()
  })
})
