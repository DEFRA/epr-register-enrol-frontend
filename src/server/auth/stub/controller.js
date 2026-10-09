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

export const STUB_USERS = [
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

function isDefraIdConfigured() {
  return Boolean(
    config.get('auth.defraId.discoveryUrl') &&
    config.get('auth.defraId.clientId')
  )
}

// Any `type` query param (a leftover from older `?type=operator` /
// `?type=regulator` links) is ignored: the chooser only offers operators.
export function stubLoginGetController(request, h) {
  const rt = request.query.rt

  confirmPostLoginRedirect(request)

  return h.view('auth/stub/login', {
    users: STUB_USERS,
    defraIdConfigured: isDefraIdConfigured(),
    rt: rt ?? ''
  })
}

export async function stubLoginPostController(request, h) {
  const { userId } = request.payload ?? {}
  const user = STUB_USERS.find((u) => u.id === userId)

  if (!user) {
    return h
      .view('auth/stub/login', {
        users: STUB_USERS,
        error: 'Please select a user'
      })
      .code(400)
  }

  const redirectTo = popPostLoginRedirect(request, '/')
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
