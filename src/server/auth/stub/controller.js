import { config } from '../../../config/config.js'

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
      roles: ['user'],
      // Defra ID relationship shape: `relationshipId:organisationId:organisationName`.
      // Covers the organisations present in the stub API data (50001–50006).
      currentRelationshipId: 'stub-rel-50001',
      relationships: [
        'stub-rel-50001:50001:NEWDEV RECYCLING LIMITED',
        'stub-rel-50002:50002:Beta Recycling Co',
        'stub-rel-50003:50003:Stub Org 50003',
        'stub-rel-50004:50004:Stub Org 50004',
        'stub-rel-50005:50005:Stub Org 50005',
        'stub-rel-50006:50006:Stub Org 50006',
        'stub-rel-67b9e8fc-2235-431a-a7b9-80663c81b6ff:67b9e8fc-2235-431a-a7b9-80663c81b6ff:Bednar - Frami Limited xTklApuT'
      ]
    }
  ]
}

export function stubLoginGetController(request, h) {
  const type = request.query.type
  const users = STUB_USERS[type]

  if (!users) {
    return h.redirect('/auth/stub/login?type=regulator')
  }

  const defraIdConfigured =
    type === 'operator' &&
    !!(
      config.get('auth.defraId.discoveryUrl') &&
      config.get('auth.defraId.clientId')
    )

  const entraIdConfigured =
    type === 'regulator' &&
    !!(
      config.get('auth.azureEntraId.clientId') &&
      config.get('auth.azureEntraId.tenantId')
    )

  return h.view('auth/stub/login', {
    type,
    users,
    defraIdConfigured,
    entraIdConfigured
  })
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
  return h.redirect('/')
}
