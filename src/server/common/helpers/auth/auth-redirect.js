import { randomUUID } from 'node:crypto'

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
 * The originally requested GET URL is stashed in the session, alongside a
 * one-time nonce carried in the login redirect's query string, so the login
 * completion handlers can send the user back to it (RA-403) rather than
 * always landing on '/'. The nonce is what stops a stash from a
 * since-abandoned login attempt leaking into a *later, unrelated* login in
 * the same session — see confirmPostLoginRedirect.
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

  let query = ''

  if (request.method === 'get' && request.yar) {
    const target = request.path + (request.url?.search ?? '')
    if (isSafeRedirectTarget(target) && !target.startsWith('/auth/')) {
      const nonce = randomUUID()
      request.yar.set(REDIRECT_SESSION_KEY[userType], { target, nonce })
      query = `?rt=${encodeURIComponent(nonce)}`
    }
  }

  return h.redirect(`/auth/${userType}/login${query}`)
}

/**
 * Called by every login entry-point GET handler (the stub chooser page, the
 * real Defra ID / Entra ID initiators) before it renders or redirects. A
 * stash is only kept if this request carries the nonce that redirectToLogin
 * minted for it — i.e. this is a continuation of the specific redirect
 * chain that created the stash, not a direct visit, a bookmark, or a stale
 * tab completing an unrelated login later in the same session. Any
 * mismatch drops the stash rather than letting it be replayed against this
 * login.
 */
export function confirmPostLoginRedirect(request, userType) {
  const key = REDIRECT_SESSION_KEY[userType]
  const stashed = request.yar.get(key)
  if (stashed && stashed.nonce !== request.query.rt) {
    request.yar.clear(key)
  }
}

/**
 * Reads and clears the URL stashed by redirectToLogin for the given user
 * type, for use by login completion handlers once a session has been
 * established. Falls back to `fallback` when nothing was stashed, or when
 * confirmPostLoginRedirect already dropped it as stale.
 */
export function popPostLoginRedirect(request, userType, fallback) {
  const key = REDIRECT_SESSION_KEY[userType]
  const stashed = request.yar.get(key)
  request.yar.clear(key)
  return stashed && isSafeRedirectTarget(stashed.target)
    ? stashed.target
    : fallback
}
