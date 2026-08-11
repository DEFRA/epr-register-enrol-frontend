// Keyed per user type, not a single shared key — otherwise a target stashed
// while bouncing to the regulator login could get replayed after an
// unrelated operator login in the same session (or vice versa), landing the
// user on a 403 access-denied page instead of home.
const REDIRECT_SESSION_KEY = {
  regulator: 'postLoginRedirectRegulator',
  operator: 'postLoginRedirectOperator'
}

// Only ever hand back a same-site path — an absolute or protocol-relative
// value in the session would turn login into an open redirect.
function isSafeRedirectTarget(target) {
  return (
    typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.startsWith('/\\')
  )
}

/**
 * onPreResponse extension that redirects unauthenticated requests to the
 * appropriate login page before the generic error handler runs.
 *
 * The target login page is determined by the route's required scope:
 *   scope: ['regulator']  → /auth/regulator/login
 *   anything else         → /auth/operator/login  (default)
 *
 * 403 (wrong user type) is intentionally not redirected — the user is already
 * authenticated and should see an access-denied error instead.
 *
 * The originally requested GET URL is stashed in the session so the login
 * completion handlers can send the user back to it (RA-403) rather than
 * always landing on '/'.
 */
export function redirectToLogin(request, h) {
  const { response } = request

  if (!response.isBoom || response.output.statusCode !== 401) {
    return h.continue
  }

  const requiredScope =
    request.route.settings.auth?.access?.[0]?.scope?.selection ?? []
  const userType = requiredScope.includes('regulator')
    ? 'regulator'
    : 'operator'

  if (request.method === 'get' && request.yar) {
    const target = request.path + (request.url?.search ?? '')
    if (isSafeRedirectTarget(target) && !target.startsWith('/auth/')) {
      request.yar.set(REDIRECT_SESSION_KEY[userType], target)
    }
  }

  return h.redirect(`/auth/${userType}/login`)
}

/**
 * Reads and clears the URL stashed by redirectToLogin for the given user
 * type, for use by login completion handlers once a session has been
 * established. Falls back to `fallback` when nothing was stashed (e.g. the
 * user navigated to a login page directly rather than being bounced there
 * from a protected page).
 */
export function popPostLoginRedirect(request, userType, fallback) {
  const key = REDIRECT_SESSION_KEY[userType]
  const target = request.yar.get(key)
  request.yar.clear(key)
  return isSafeRedirectTarget(target) ? target : fallback
}
