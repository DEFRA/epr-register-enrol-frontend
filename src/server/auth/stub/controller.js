import { config } from '../../../config/config.js'
import {
  STUB_OPERATOR_RELATIONSHIPS,
  STUB_OPERATOR_CURRENT_RELATIONSHIP_ID
} from '../../common/stub-operator-orgs.js'
import {
  confirmPostLoginRedirect,
  popPostLoginRedirect
} from '../../common/helpers/auth/auth-redirect.js'
import { markLoginAndNotifyPrevious } from '../../common/helpers/auth/concurrent-login.js'

export const STUB_USERS = {
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

export function stubLoginGetController(request, h) {
  const type = request.query.type
  const rt = request.query.rt

  const users = getStubUsers(type)

  // Missing or unknown type (including the retired `type=regulator`) falls
  // back to the operator chooser, the only user type this service has.
  if (!users) {
    return h.redirect(stubLoginUrl('operator', rt))
  }

  confirmPostLoginRedirect(request, type)

  return h.view('auth/stub/login', {
    type,
    users,
    defraIdConfigured: isDefraIdConfigured(type),
    rt: rt ?? ''
  })
}

export async function stubLoginPostController(request, h) {
  const { userId, type } = request.payload

  const users = getStubUsers(type) ?? []
  const user = users.find((u) => u.id === userId)

  if (!user) {
    return h
      .view('auth/stub/login', {
        type,
        users: getStubUsers(type) ?? [],
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
  // RA-462: mirror the real callbacks so the concurrent-login notice works
  // under stub auth too (local dev + e2e).
  await markLoginAndNotifyPrevious(request, user.id)
  return h.redirect(redirectTo)
}
