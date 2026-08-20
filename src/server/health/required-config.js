// Surfaces config that's structurally required in a deployed environment but only
// fails, if missing, deep inside whichever request first exercises it (e.g. a blank
// API_BASE_URL doesn't error until the first backend call) — the same failure shape
// documented in RA-441. Returns the list of missing env var names (never values) so
// /health/ready can report exactly what's absent without crashing the process the
// way the boot-time guards in config.js do for the subset they already cover.
//
// This is deliberately a separate mechanism from those boot-time throws: crashing
// on missing config makes the platform's liveness probe restart-loop a container
// that will never come up, which is worse than a health check that just reports
// "not ready" (see RA-441 in the sibling epr-register-enrol-backend repo for the
// incident that established this pattern). /health itself must stay untouched.
export function getMissingRequiredConfig(cfg) {
  const missing = []
  const isLocal = cfg.get('environment') === 'local'
  const stubEnabled = cfg.get('auth.stubEnabled')

  // realApiClient (src/server/common/api-client.js) always contacts the real
  // backend regardless of api.stubEnabled — used for file upload features — so
  // this is load-bearing even when the main apiClient singleton is stubbed.
  if (!isLocal && !cfg.get('api.baseUrl')) {
    missing.push('API_BASE_URL')
  }

  // FrontendAuthenticationHandler (epr-register-enrol-backend) rejects every request
  // without this outside its own Development environment. Same api.stubEnabled-agnostic
  // condition as API_BASE_URL above, not the stub-exempt condition used further down —
  // realApiClient reads this same sharedSecret and always contacts the real backend
  // regardless of api.stubEnabled, so a blank secret in a stubbed-but-deployed
  // environment would still send unauthenticated requests even though the main
  // apiClient singleton is stubbed.
  if (!isLocal && !cfg.get('api.sharedSecret')) {
    missing.push('AUTH_SHARED_SECRET__BACKEND')
  }

  // Only load-bearing once real (non-stub) auth is active outside local dev —
  // mirrors the condition reExBackLinkUrl itself uses (operator-accreditation/controller.js).
  if (!stubEnabled && !isLocal && !cfg.get('reex.frontendBaseUrl')) {
    missing.push('REEX_FRONTEND_BASE_URL')
  }

  // Same real-auth-outside-local condition as the existing ENTRA_CLIENT_ID/
  // ENTRA_CLIENT_SECRET boot guard in config.js — tenantId is just as load-bearing
  // (used to build the Microsoft OAuth URLs) but was never included in that guard.
  if (!stubEnabled && !isLocal && !cfg.get('auth.azureEntraId.tenantId')) {
    missing.push('ENTRA_TENANT_ID')
  }

  // Same real-auth-outside-local condition as the existing DEFRA_ID_CLIENT_ID/
  // DEFRA_ID_CLIENT_SECRET/DEFRA_ID_DISCOVERY_URL boot guard — serviceId was
  // never included in that guard despite being used in the same auth flow.
  if (!stubEnabled && !isLocal && !cfg.get('auth.defraId.serviceId')) {
    missing.push('DEFRA_ID_SERVICE_ID')
  }

  // AUTH_CALLBACK_BASE_URL defaults to a localhost placeholder so local dev works
  // without it — that default reaching a deployed environment would silently
  // misdirect every OAuth redirect/logout URL rather than fail outright.
  if (!isLocal && cfg.get('auth.callbackBaseUrl') === 'http://localhost:3000') {
    missing.push('AUTH_CALLBACK_BASE_URL')
  }

  // BASIC_USER/BASIC_PASSWD are deliberately not checked here — basic-auth-plugin.js
  // already throws at server registration if auth.basicEnabled is true and either is
  // blank, which crashes boot before this endpoint could ever report on it.

  return missing
}
