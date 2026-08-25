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

// `type` is caller-controlled (query param / form field); a plain STUB_USERS[type]
// lookup resolves inherited Object.prototype keys (e.g. type=constructor
// returns the Object constructor function, not undefined), which then blows
// up wherever the result is treated as a user array. Object.hasOwn confines
// the lookup to STUB_USERS' own keys.
function getStubUsers(type) {
  return Object.hasOwn(STUB_USERS, type) ? STUB_USERS[type] : undefined
}

function stubLoginUrl(type, rt) {
  const rtParam = rt ? `&rt=${encodeURIComponent(rt)}` : ''
  return `/auth/stub/login?type=${type}${rtParam}`
}

function isDefraIdConfigured(type) {
  return (
    type === 'operator' &&
    Boolean(
      config.get('auth.defraId.discoveryUrl') &&
      config.get('auth.defraId.clientId')
    )
  )
}

function isEntraIdConfigured(type) {
  return (
    type === 'regulator' &&
    Boolean(
      config.get('auth.azureEntraId.clientId') &&
      config.get('auth.azureEntraId.tenantId')
    )
  )
}

export function stubLoginGetController(request, h) {
  const type = request.query.type
  const rt = request.query.rt

  if (type === 'regulator' && regulatorAccessDisabled()) {
    throw Boom.notFound()
  }

  const users = getStubUsers(type)

  if (!users) {
    const fallbackType = regulatorAccessDisabled() ? 'operator' : 'regulator'
    return h.redirect(stubLoginUrl(fallbackType, rt))
  }

  confirmPostLoginRedirect(request, type)

  return h.view('auth/stub/login', {
    type,
    users,
    defraIdConfigured: isDefraIdConfigured(type),
    entraIdConfigured: isEntraIdConfigured(type),
    regulatorAccessDisabled: regulatorAccessDisabled(),
    rt: rt ?? ''
  })
}

export async function stubLoginPostController(request, h) {
  const { userId, type } = request.payload

  if (type === 'regulator' && regulatorAccessDisabled()) {
    throw Boom.notFound()
  }

  const users = getStubUsers(type) ?? []
  const user = users.find((u) => u.id === userId)

  if (!user) {
    return h
      .view('auth/stub/login', {
        type,
        users: getStubUsers(type) ?? [],
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
