// Returns OAuth2 endpoint config for Defra ID.
// DEFRA_ID_DISCOVERY_URL is set to the appropriate endpoint by the deployment pipeline.
export function getDefraIdConfig(config) {
  const discoveryUrl = config.get('auth.defraId.discoveryUrl')
  const callbackUrl = `${config.get('auth.callbackBaseUrl')}/auth/operator/callback`
  return {
    authUrl: `${discoveryUrl}/authorize`,
    tokenUrl: `${discoveryUrl}/token`,
    profileUrl: `${discoveryUrl}/userinfo`,
    scopes: ['openid', 'profile', 'email'],
    clientId: config.get('auth.defraId.clientId'),
    clientSecret: config.get('auth.defraId.clientSecret'),
    callbackUrl
  }
}
