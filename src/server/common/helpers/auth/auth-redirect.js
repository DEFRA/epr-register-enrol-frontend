/**
 * onPreResponse extension that redirects unauthenticated requests to the
 * appropriate login page before the generic error handler runs.
 *
 * The target login page is determined by the route's required scope:
 *   scope: ['operator']   → /auth/operator/login
 *   scope: ['regulator']  → /auth/regulator/login  (default)
 *
 * 403 (wrong user type) is intentionally not redirected — the user is already
 * authenticated and should see an access-denied error instead.
 */
export function redirectToLogin(request, h) {
  const { response } = request

  if (!response.isBoom || response.output.statusCode !== 401) {
    return h.continue
  }

  const requiredScope =
    request.route.settings.auth?.access?.[0]?.scope?.selection ?? []

  if (requiredScope.includes('operator')) {
    return h.redirect('/auth/operator/login')
  }

  return h.redirect('/auth/regulator/login')
}
