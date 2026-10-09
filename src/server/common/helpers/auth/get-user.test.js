import { getUser } from './get-user.js'

describe('#getUser', () => {
  test('returns credentials when authenticated', () => {
    const request = {
      auth: { credentials: { id: '1', userType: 'regulator' } }
    }
    expect(getUser(request)).toEqual({ id: '1', userType: 'regulator' })
  })

  test('returns null when auth is absent', () => {
    expect(getUser({})).toBeNull()
  })

  test('returns null when credentials is absent', () => {
    expect(getUser({ auth: {} })).toBeNull()
  })
})
