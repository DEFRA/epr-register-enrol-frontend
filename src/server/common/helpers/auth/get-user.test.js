import { getUser, isOperator } from './get-user.js'

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

describe('#isOperator', () => {
  test('returns true for operator credentials', () => {
    const request = { auth: { credentials: { userType: 'operator' } } }
    expect(isOperator(request)).toBe(true)
  })

  test('returns false for regulator credentials', () => {
    const request = { auth: { credentials: { userType: 'regulator' } } }
    expect(isOperator(request)).toBe(false)
  })

  test('returns false when unauthenticated', () => {
    expect(isOperator({})).toBe(false)
  })
})
