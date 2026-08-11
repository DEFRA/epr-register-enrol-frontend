import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { STUB_USERS } from './stub/controller.js'
import { config } from '../../config/config.js'

// Captured once, before either describe block below installs a vi.spyOn on
// config.get — spying twice without restoring in between would otherwise
// make the second block's "fall through to original" call resolve back into
// itself (vi.spyOn mutates the existing spy's implementation in place rather
// than layering a new one), causing infinite recursion.
const originalConfigGet = config.get.bind(config)

describe('#logoutController', () => {
  let server

  beforeAll(async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalConfigGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  async function loginAs(type) {
    const { headers } = await server.inject({
      method: 'POST',
      url: '/auth/stub/login',
      payload: {
        userId: STUB_USERS[type][0].id,
        type
      },
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    return headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
  }

  test('redirects a stub regulator to the regulator login page', async () => {
    const cookie = await loginAs('regulator')

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/logout',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        cookie
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/regulator/login')
  })

  test('redirects a stub operator to the operator login page', async () => {
    const cookie = await loginAs('operator')

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/logout',
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        cookie
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/operator/login')
  })

  test('redirects to the operator login page when there is no session', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/auth/logout',
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/operator/login')
  })
})

// The tests above only exercise /auth/logout, which has auth: false, so they
// never touch the real session-validation scheme. Proving a signed-out
// session is actually revoked (AC04) requires the real 'yar-session' auth
// scheme instead of the test-bypass scheme stubAuthPlugin registers when
// config.get('isTest') is true (which authenticates every request from the
// x-test-user-type header, ignoring cookies entirely). This suite forces
// isTest: false — still stub-login, but with real cookie-based session
// checks and crumb (CSRF) enforcement — on its own server instance so the
// other tests above are unaffected.
describe('#logoutController session revocation (real yar-session scheme)', () => {
  let server

  beforeAll(async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      if (key === 'isTest') return false
      return originalConfigGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.restoreAllMocks()
  })

  async function loginAs(type) {
    const crumbResponse = await server.inject({
      method: 'GET',
      url: `/auth/stub/login?type=${type}`,
      headers: { Authorization: 'Basic dGVzdDp0ZXN0MTIz' }
    })
    const crumbCookie = crumbResponse.headers['set-cookie']
      .find((c) => c.startsWith('crumb='))
      .split(';')[0]
    const crumb = crumbCookie.split('=')[1]

    const loginResponse = await server.inject({
      method: 'POST',
      url: '/auth/stub/login',
      payload: { userId: STUB_USERS[type][0].id, type, crumb },
      headers: {
        Authorization: 'Basic dGVzdDp0ZXN0MTIz',
        cookie: crumbCookie
      }
    })

    return loginResponse.headers['set-cookie']
      .find((c) => c.startsWith('session='))
      .split(';')[0]
  }

  test.each(['operator', 'regulator'])(
    'a signed-out %s session can no longer authenticate, even replaying the pre-logout cookie',
    async (type) => {
      const oldSessionCookie = await loginAs(type)

      await server.inject({
        method: 'GET',
        url: '/auth/logout',
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0MTIz',
          cookie: oldSessionCookie
        }
      })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/',
        headers: {
          Authorization: 'Basic dGVzdDp0ZXN0MTIz',
          cookie: oldSessionCookie
        }
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toMatch(
        /^\/auth\/(operator|regulator)\/login(\?rt=.+)?$/
      )
    }
  )
})
