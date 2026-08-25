import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

const originalConfigGet = config.get.bind(config)

function mockConfig(overrides) {
  vi.spyOn(config, 'get').mockImplementation((key) =>
    key in overrides ? overrides[key] : originalConfigGet(key)
  )
}

describe('#regulator access (RA-427) — REGULATOR_ACCESS_DISABLED=true', () => {
  let server

  beforeAll(async () => {
    mockConfig({
      'auth.regulatorAccessDisabled': true,
      // Configured deliberately so the tests below prove the flag wins over
      // real Entra ID credentials being present, not just that the
      // entra-id route was never going to register anyway.
      'auth.azureEntraId.clientId': 'test-client-id',
      'auth.azureEntraId.tenantId': 'test-tenant-id'
    })

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  test('GET /regulator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/regulator'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /{language}/regulator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/cy/regulator'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/regulator/login 404s (stub chooser entry point)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/login'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/regulator/entra-id 404s even with Entra ID credentials configured', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/entra-id'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/regulator/callback 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/callback?code=abc&state=xyz'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/stub/login?type=regulator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/stub/login?type=regulator'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('POST /auth/stub/login with type=regulator 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/auth/stub/login',
      payload: { type: 'regulator', userId: 'stub-reg-1', crumb: 'ignored' }
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/stub/login with no type falls back to operator, not regulator', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/stub/login'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/stub/login?type=operator')
  })

  test('stub login chooser for operator does not show "switch to regulator login"', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/auth/stub/login?type=operator'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('Switch to regulator login')
  })

  test('operator login is unaffected', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/operator/login'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/stub/login?type=operator')
  })
})

describe('#regulator access (RA-427) — disabled with stub auth off (real OAuth)', () => {
  let server

  beforeAll(async () => {
    mockConfig({
      'auth.regulatorAccessDisabled': true,
      'auth.stubEnabled': false,
      'auth.azureEntraId.clientId': 'test-client-id',
      'auth.azureEntraId.clientSecret': 'test-client-secret',
      'auth.azureEntraId.tenantId': 'test-tenant-id'
    })

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  test('GET /auth/regulator/login 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/login'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('GET /auth/regulator/callback 404s', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/callback?code=abc&state=xyz'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('operator login route still exists (not swallowed by the regulator kill switch)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/auth/operator/login'
    })

    // Not asserting a specific redirect target here — that depends on the
    // Defra ID discovery endpoint being reachable — just that the route
    // still exists and isn't a 404.
    expect(statusCode).not.toBe(statusCodes.notFound)
  })
})

describe('#regulator access (RA-427) — REGULATOR_ACCESS_DISABLED=false (default)', () => {
  let server

  beforeAll(async () => {
    mockConfig({ 'auth.regulatorAccessDisabled': false })

    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  test('GET /regulator works', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/regulator'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('GET /auth/regulator/login works (redirects to stub chooser)', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/login'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/stub/login?type=regulator')
  })

  test('stub login chooser for operator shows "switch to regulator login"', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/auth/stub/login?type=operator'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Switch to regulator login')
  })
})
