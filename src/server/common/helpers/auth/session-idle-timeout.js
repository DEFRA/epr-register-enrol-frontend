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
