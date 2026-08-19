import Boom from '@hapi/boom'

import { config } from '../../../../config/config.js'

const LAST_ACTIVITY_KEY = 'lastActivityAt'

// No prior activity recorded (e.g. the first authenticated request right
// after login) is treated as fresh, not idle - touchLastActivity stamps it
// on that same request so subsequent requests have something to compare.
export function isSessionIdle(yar, idleTimeoutMs) {
  const lastActivityAt = yar.get(LAST_ACTIVITY_KEY)
  if (!lastActivityAt) {
    return false
  }
  return Date.now() - lastActivityAt >= idleTimeoutMs
}

export function touchLastActivity(yar) {
  yar.set(LAST_ACTIVITY_KEY, Date.now())
}

// Shared by auth-plugin.js and stub-auth-plugin.js (non-test branch), both of
// which register this as their 'yar-session' Hapi auth scheme. Kept in one
// place so the idle-timeout check can't drift between the real-OAuth and
// local-stub auth paths (RA-461) - previously identical logic was duplicated
// separately in each file.
export function yarSessionAuthenticate(request, h) {
  const user = request.yar.get('user')
  if (!user) {
    return h.unauthenticated(Boom.unauthorized(null, 'session'))
  }

  if (isSessionIdle(request.yar, config.get('session.idleTimeoutMs'))) {
    request.yar.reset()
    return h.unauthenticated(Boom.unauthorized(null, 'session'))
  }

  touchLastActivity(request.yar)

  return h.authenticated({
    credentials: {
      ...user,
      scope: [
        user.userType,
        ...(user.regulatorRole ? [user.regulatorRole] : [])
      ]
    }
  })
}
