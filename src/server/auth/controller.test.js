import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { STUB_USERS } from './stub/controller.js'
import { config } from '../../config/config.js'

describe('#logoutController', () => {
  let server

  beforeAll(async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.basicUsr') return 'test'
      if (key === 'auth.basicPasswd') return 'test123'
      return originalGet(key)
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
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
