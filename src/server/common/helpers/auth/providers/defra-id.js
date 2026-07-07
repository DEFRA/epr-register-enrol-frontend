// DEFRA_ID_DISCOVERY_URL must be the full OIDC metadata URL. Examples by environment:
//   CPDEV:    https://your-account.cpdev.cui.defra.gov.uk/idphub/b2c/b2c_1a_cui_cpdev_signupsignin/.well-known/openid-configuration
//   CPTEST:   https://your-account.cptst.cui.defra.gov.uk/idphub/b2c/b2c_1a_cui_signupsignin/.well-known/openid-configuration
//   PRE-PROD: https://your-account.pre.cui.defra.gov.uk/idphub/b2c/b2c_1a_cui_signupsignin/.well-known/openid-configuration
//   PROD:     https://your-account.defra.gov.uk/idphub/b2c/b2c_1a_cui_signupsignin/.well-known/openid-configuration
// The authorization_endpoint, token_endpoint, and end_session_endpoint are read from that document.

let endpointCache = null

export function getDefraIdConfig(config) {
  const clientId = config.get('auth.defraId.clientId')
  const callbackUrl = `${config.get('auth.callbackBaseUrl')}/auth/operator/callback`
  return {
    discoveryUrl: config.get('auth.defraId.discoveryUrl'),
    // Scopes: openid for ID token, offline_access for refresh token, client_id for access token.
    scopes: ['openid', 'offline_access', clientId],
    clientId,
    clientSecret: config.get('auth.defraId.clientSecret'),
    serviceId: config.get('auth.defraId.serviceId'),
    callbackUrl
  }
}

export async function getDefraIdEndpoints(discoveryUrl) {
  if (endpointCache) return endpointCache
  const response = await fetch(discoveryUrl)
  if (!response.ok) {
    throw new Error(`Defra ID OIDC discovery failed: ${response.status}`)
  }
  const doc = await response.json()
  endpointCache = {
    authUrl: doc.authorization_endpoint,
    tokenUrl: doc.token_endpoint,
    endSessionUrl: doc.end_session_endpoint,
    jwksUri: doc.jwks_uri,
    issuer: doc.issuer
  }
  return endpointCache
}
