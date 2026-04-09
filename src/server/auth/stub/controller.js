export const STUB_USERS = {
  regulator: [
    {
      id: 'stub-reg-1',
      name: 'Stub Regulator',
      email: 'regulator@stub.example',
      userType: 'regulator',
      roles: ['admin']
    }
  ],
  operator: [
    {
      id: 'stub-op-1',
      name: 'Stub Operator',
      email: 'operator@stub.example',
      userType: 'operator',
      roles: ['user']
    }
  ]
}

export function stubLoginGetController(request, h) {
  const type = request.query.type
  const users = STUB_USERS[type]

  if (!users) {
    return h.redirect('/auth/stub/login?type=regulator')
  }

  return h.view('auth/stub/login', { type, users })
}

export async function stubLoginPostController(request, h) {
  const { userId, type } = request.payload
  const users = STUB_USERS[type] ?? []
  const user = users.find((u) => u.id === userId)

  if (!user) {
    return h
      .view('auth/stub/login', {
        type,
        users: STUB_USERS[type] ?? [],
        error: 'Please select a user'
      })
      .code(400)
  }

  request.yar.set('user', user)
  request.cookieAuth?.set(user)
  return h.redirect('/')
}
