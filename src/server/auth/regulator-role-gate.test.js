import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { config } from '../../config/config.js'

const originalConfigGet = config.get.bind(config)

vi.mock('../common/helpers/auth/providers/azure-id-token.js', () => ({
  verifyAzureIdToken: vi.fn()
}))

const { verifyAzureIdToken } =
  await import('../common/helpers/auth/providers/azure-id-token.js')

const REGULATOR_ROLE = 'Waste.Regulator.Standard'
const SUPPORT_USER_ROLE = 'Waste.SupportUser.ReadOnly'

describe('#regulatorCallbackController role gate', () => {
  let server

  beforeAll(async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      switch (key) {
        case 'isTest':
          return false
        case 'auth.stubEnabled':
          return false
        case 'auth.azureEntraId.clientId':
          return 'test-client-id'
        case 'auth.azureEntraId.clientSecret':
          return 'test-client-secret'
        case 'auth.azureEntraId.tenantId':
          return 'test-tenant-id'
        case 'auth.azureEntraId.regulatorRoleValue':
          return REGULATOR_ROLE
        case 'auth.azureEntraId.supportUserRoleValue':
          return SUPPORT_USER_ROLE
        default:
          return originalConfigGet(key)
      }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        async json() {
          return { id_token: 'fake-id-token' }
        }
      }))
    )

    server = await createServer()
    await server.initialize()

    server.route({
      method: 'GET',
      path: '/test-credentials-check',
      handler: (request, h) => h.response(request.auth.credentials)
    })
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function startLoginAndGetCallbackUrl() {
    const { headers } = await server.inject({
      method: 'GET',
      url: '/auth/regulator/login'
    })
    const cookie = headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
    const location = new URL(headers.location)
    const state = location.searchParams.get('state')

    return {
      cookie,
      callbackUrl: `/auth/regulator/callback?code=abc&state=${state}`
    }
  }

  test('creates a session when the caller holds the regulator role', async () => {
    verifyAzureIdToken.mockResolvedValue({
      oid: 'user-1',
      preferred_username: 'reg@example.com',
      name: 'Reg User',
      roles: [REGULATOR_ROLE]
    })

    const { cookie, callbackUrl } = await startLoginAndGetCallbackUrl()

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: callbackUrl,
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/')

    const sessionCookie = headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ')

    const { result } = await server.inject({
      method: 'GET',
      url: '/test-credentials-check',
      headers: { cookie: sessionCookie }
    })

    expect(result).toMatchObject({
      userType: 'regulator',
      regulatorRole: 'regulator-standard',
      scope: ['regulator', 'regulator-standard']
    })
  })

  test('creates a session when the caller holds the support user role', async () => {
    verifyAzureIdToken.mockResolvedValue({
      oid: 'user-2',
      preferred_username: 'support@example.com',
      name: 'Support User',
      roles: [SUPPORT_USER_ROLE]
    })

    const { cookie, callbackUrl } = await startLoginAndGetCallbackUrl()

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: callbackUrl,
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/')

    const sessionCookie = headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ')

    const { result } = await server.inject({
      method: 'GET',
      url: '/test-credentials-check',
      headers: { cookie: sessionCookie }
    })

    expect(result).toMatchObject({
      userType: 'regulator',
      regulatorRole: 'regulator-support-readonly',
      scope: ['regulator', 'regulator-support-readonly']
    })
  })

  test('shows the access-denied page and does not create a session when the caller holds neither role', async () => {
    verifyAzureIdToken.mockResolvedValue({
      oid: 'user-3',
      preferred_username: 'nobody@example.com',
      name: 'No Role User',
      roles: ['SomeOtherRole']
    })

    const { cookie, callbackUrl } = await startLoginAndGetCallbackUrl()

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: callbackUrl,
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(result).toContain('data-testid="access-denied-message"')

    const { statusCode: nextStatusCode, headers: nextHeaders } =
      await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

    expect(nextStatusCode).toBe(statusCodes.redirect)
    expect(nextHeaders.location).toMatch(/^\/auth\/(operator|regulator)\/login/)
  })

  test('shows the access-denied page when the caller has no roles claim at all', async () => {
    verifyAzureIdToken.mockResolvedValue({
      oid: 'user-4',
      preferred_username: 'noroles@example.com',
      name: 'No Roles Claim User'
    })

    const { cookie, callbackUrl } = await startLoginAndGetCallbackUrl()

    const { statusCode } = await server.inject({
      method: 'GET',
      url: callbackUrl,
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.forbidden)
  })
})
