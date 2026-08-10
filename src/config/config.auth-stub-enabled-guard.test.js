import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

const REAL_SECRET = 'a'.repeat(48)

// config.js throws at module-load time when the guard trips, so each test
// must re-import it fresh with the relevant env vars set beforehand — a
// static top-of-file import would crash test collection for the whole file.
describe('auth stub enabled boot guard', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('production boot rejects AUTH_STUB_ENABLED=true when ENVIRONMENT=prod', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'true'

    await expect(import('./config.js')).rejects.toThrow(/AUTH_STUB_ENABLED/)
  })

  test('production boot succeeds when ENVIRONMENT=prod and AUTH_STUB_ENABLED=false', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'prod'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'false'

    const mod = await import('./config.js')
    expect(mod.config.get('auth.stubEnabled')).toBe(false)
  })

  // Load-bearing regression test: deployed non-prod tiers (dev/test/ext-test)
  // legitimately run NODE_ENV=production with stub auth on. This must keep
  // working — do not "strengthen" the guard by adding an isProduction check,
  // that would break this case.
  test('ENVIRONMENT=dev with AUTH_STUB_ENABLED=true does not throw, even with NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'dev'
    process.env.SESSION_COOKIE_PASSWORD = REAL_SECRET
    process.env.AUTH_STUB_ENABLED = 'true'

    const mod = await import('./config.js')
    expect(mod.config.get('auth.stubEnabled')).toBe(true)
    expect(mod.config.get('isProduction')).toBe(true)
  })

  test('an invalid ENVIRONMENT value is rejected by convict before this guard ever runs', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'Production'
    delete process.env.SESSION_COOKIE_PASSWORD
    delete process.env.AUTH_STUB_ENABLED

    await expect(import('./config.js')).rejects.toThrow(
      /must be one of the possible values/
    )
  })
})
