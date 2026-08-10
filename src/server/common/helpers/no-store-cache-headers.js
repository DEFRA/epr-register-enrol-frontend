/**
 * onPreResponse extension that stops the browser from caching rendered pages,
 * so a back-button navigation after sign-out can't show stale authenticated
 * content instead of re-requesting (and re-authenticating) the page.
 *
 * Scoped to 'view' responses only — this naturally excludes static assets
 * (served as 'file' variety, which should stay cacheable) and redirects.
 */
export function noStoreCacheHeaders(request, h) {
  const { response } = request

  if (response.variety === 'view') {
    response.header('cache-control', 'no-store, no-cache, must-revalidate')
    response.header('pragma', 'no-cache')
  }

  return h.continue
}
