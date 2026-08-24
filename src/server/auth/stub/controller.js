import Boom from '@hapi/boom'

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
import { isRegulatorAccessDisabled as regulatorAccessDisabled } from '../../common/helpers/auth/regulator-access.js'

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

// RA-427: type=regulator shares this route (and its POST counterpart below)
// with type=operator via a query param rather than a route of its own, so
// it can't be disabled by simply not registering a route — both handlers
// must check regulatorAccessDisabled() explicitly.

export function stubLoginGetController(request, h) {
  const type = request.query.type
  const rt = request.query.rt

  if (type === 'regulator' && regulatorAccessDisabled()) {
    throw Boom.notFound()
  }

  const users = STUB_USERS[type]

  if (!users) {
    const fallbackType = regulatorAccessDisabled() ? 'operator' : 'regulator'
    return h.redirect(
      `/auth/stub/login?type=${fallbackType}${rt ? `&rt=${encodeURIComponent(rt)}` : ''}`
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
    regulatorAccessDisabled: regulatorAccessDisabled(),
    rt: rt ?? ''
  })
}

export async function stubLoginPostController(request, h) {
  const { userId, type } = request.payload

  if (type === 'regulator' && regulatorAccessDisabled()) {
    throw Boom.notFound()
  }

  const users = STUB_USERS[type] ?? []
  const user = users.find((u) => u.id === userId)

  if (!user) {
    return h
      .view('auth/stub/login', {
        type,
        users: STUB_USERS[type] ?? [],
        regulatorAccessDisabled: regulatorAccessDisabled(),
        error: 'Please select a user'
      })
      .code(400)
  }

  const redirectTo = popPostLoginRedirect(request, type, '/')
  // Session fixation defence-in-depth (M3, 2026-08-08 pentest report),
  // matching the real OAuth callbacks (controller.js) — reset before
  // establishing the authenticated session so a pre-auth session id can't be
  // reused post-login.
  request.yar.reset()
  request.yar.set('user', user)
  return h.redirect(redirectTo)
}
