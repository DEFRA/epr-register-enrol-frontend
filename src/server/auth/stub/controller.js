import { config } from '../../../config/config.js'
import {
  STUB_OPERATOR_RELATIONSHIPS,
  STUB_OPERATOR_CURRENT_RELATIONSHIP_ID
} from '../../common/stub-operator-orgs.js'
import {
  confirmPostLoginRedirect,
  popPostLoginRedirect
} from '../../common/helpers/auth/auth-redirect.js'
import { ROLE_REGULATOR_STANDARD } from '../../common/helpers/auth/auth-scopes.js'

export const STUB_USERS = {
  regulator: [
    {
      id: 'stub-reg-1',
      name: 'Stub Regulator',
      email: 'regulator@stub.example',
      userType: 'regulator',
      roles: ['admin'],
      regulatorRole: ROLE_REGULATOR_STANDARD
    }
  ],
  operator: [
    {
      id: 'stub-op-1',
      name: 'Stub Operator',
      email: 'test@defra.gov.uk',
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
  const rt = request.query.rt

  if (!users) {
    return h.redirect(
      `/auth/stub/login?type=regulator${rt ? `&rt=${encodeURIComponent(rt)}` : ''}`
    )
  }

  confirmPostLoginRedirect(request, type)

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
    entraIdConfigured,
    rt: rt ?? ''
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

  const redirectTo = popPostLoginRedirect(request, type, '/')
  request.yar.set('user', user)
  return h.redirect(redirectTo)
}
