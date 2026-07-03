import { config } from '../../config/config.js'
import { getAzureEntraIdConfig } from '../common/helpers/auth/providers/azure-entra-id.js'
import {
  getDefraIdConfig,
  getDefraIdEndpoints
} from '../common/helpers/auth/providers/defra-id.js'
import { verifyDefraIdToken } from '../common/helpers/auth/providers/defra-id-token.js'

// --- Login — redirect to provider ---

export function regulatorLoginController(request, h) {
  const provider = getAzureEntraIdConfig(config)
  const state = crypto.randomUUID()
  request.yar.set('oauthState', state)

  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    redirect_uri: provider.callbackUrl,
    scope: provider.scopes.join(' '),
    state
  })

  return h.redirect(`${provider.authUrl}?${params}`)
}

export async function operatorLoginController(request, h) {
  const provider = getDefraIdConfig(config)
  const { authUrl } = await getDefraIdEndpoints(provider.discoveryUrl)
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  request.yar.set('oauthState', state)
  request.yar.set('oauthNonce', nonce)

  const params = new URLSearchParams({
    client_id: provider.clientId,
    serviceId: provider.serviceId,
    response_type: 'code',
    redirect_uri: provider.callbackUrl,
    scope: provider.scopes.join(' '),
    state,
    nonce
  })

  return h.redirect(`${authUrl}?${params}`)
}

// --- Callbacks — exchange code for session ---

export async function regulatorCallbackController(request, h) {
  const { code, state } = request.query
  const storedState = request.yar.get('oauthState')

  if (!code || !state || state !== storedState) {
    return h.redirect('/auth/regulator/login')
  }

  request.yar.clear('oauthState')

  const provider = getAzureEntraIdConfig(config)

  const tokenResponse = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: provider.callbackUrl
    })
  })

  if (!tokenResponse.ok) {
    return h.redirect('/auth/regulator/login')
  }

  const { access_token: accessToken } = await tokenResponse.json()

  const profileResponse = await fetch(provider.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!profileResponse.ok) {
    return h.redirect('/auth/regulator/login')
  }

  const profile = await profileResponse.json()

  const user = {
    id: profile.id,
    email: profile.mail || profile.userPrincipalName,
    name: profile.displayName,
    userType: 'regulator'
  }

  request.yar.set('user', user)
  return h.redirect('/')
}

export async function operatorCallbackController(request, h) {
  const { code, state } = request.query
  const storedState = request.yar.get('oauthState')
  const storedNonce = request.yar.get('oauthNonce')

  if (!code || !state || state !== storedState) {
    return h.redirect('/auth/operator/login')
  }

  request.yar.clear('oauthState')
  request.yar.clear('oauthNonce')

  if (!storedNonce) {
    return h.redirect('/auth/operator/login')
  }

  const provider = getDefraIdConfig(config)
  const { tokenUrl, jwksUri, issuer } = await getDefraIdEndpoints(
    provider.discoveryUrl
  )

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: provider.callbackUrl,
      scope: provider.scopes.join(' ')
    })
  })

  if (!tokenResponse.ok) {
    return h.redirect('/auth/operator/login')
  }

  const { id_token: idToken } = await tokenResponse.json()

  if (!idToken) {
    return h.redirect('/auth/operator/login')
  }

  let claims
  try {
    claims = await verifyDefraIdToken(idToken, {
      jwksUri,
      issuer,
      audience: provider.clientId,
      expectedNonce: storedNonce
    })
  } catch {
    return h.redirect('/auth/operator/login')
  }

  const user = {
    id: claims.sub,
    email: claims.email,
    name: `${claims.firstName ?? ''} ${claims.lastName ?? ''}`.trim(),
    contactId: claims.contactId,
    currentRelationshipId: claims.currentRelationshipId,
    relationships: claims.relationships ?? [],
    roles: claims.roles ?? [],
    userType: 'operator'
  }

  // Store the raw id_token so it can be passed as id_token_hint during logout.
  request.yar.set('idToken', idToken)
  request.yar.set('user', user)
  return h.redirect('/')
}

// --- Logout ---

export async function logoutController(request, h) {
  const user = request.yar.get('user')
  const idToken = request.yar.get('idToken')

  // Only do federated logout when we have an id_token — that means the user
  // authenticated via real Defra ID (stub users never get one).
  if (!idToken || user?.userType !== 'operator') {
    request.yar.clear('user')
    request.yar.clear('idToken')
    return h.redirect('/auth/operator/login')
  }

  const provider = getDefraIdConfig(config)
  const { endSessionUrl } = await getDefraIdEndpoints(provider.discoveryUrl)

  // Clear local session before redirecting — if the user returns to /auth/logout
  // after Defra ID signs them out, the session will be empty and we fall through
  // to the redirect above.
  request.yar.clear('idToken')
  request.yar.clear('user')

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${config.get('auth.callbackBaseUrl')}/auth/logout`
  })
  params.set('id_token_hint', idToken)

  return h.redirect(`${endSessionUrl}?${params}`)
}
