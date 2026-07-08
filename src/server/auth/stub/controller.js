import { config } from '../../../config/config.js'
import {
  STUB_OPERATOR_RELATIONSHIPS,
  STUB_OPERATOR_CURRENT_RELATIONSHIP_ID
} from '../../common/stub-operator-orgs.js'

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
      // Relationships (and the /defra-link map) are derived from the shared
      // STUB_OPERATOR_ORGS fixture so they cannot drift apart.
      currentRelationshipId: STUB_OPERATOR_CURRENT_RELATIONSHIP_ID,
      relationships: STUB_OPERATOR_RELATIONSHIPS
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
