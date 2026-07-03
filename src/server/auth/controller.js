import { createHash, randomBytes } from 'node:crypto'

import { config } from '../../config/config.js'
import { getAzureEntraIdConfig } from '../common/helpers/auth/providers/azure-entra-id.js'
import { verifyAzureIdToken } from '../common/helpers/auth/providers/azure-id-token.js'
import {
  getDefraIdConfig,
  getDefraIdEndpoints
} from '../common/helpers/auth/providers/defra-id.js'

function randomToken(bytes = 32) {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function pkceChallenge(verifier) {
  return createHash('sha256')
    .update(verifier)
    .digest()
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

// --- Login — redirect to provider ---

export function regulatorLoginController(request, h) {
  const provider = getAzureEntraIdConfig(config)
  const state = randomToken()
  const nonce = randomToken()
  const codeVerifier = randomToken(64)
  const codeChallenge = pkceChallenge(codeVerifier)

  request.yar.set('oauthState', state)
  request.yar.set('oauthNonce', nonce)
  request.yar.set('pkceVerifier', codeVerifier)

  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    redirect_uri: provider.callbackUrl,
    scope: provider.scopes.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
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
  const storedNonce = request.yar.get('oauthNonce')
  const storedVerifier = request.yar.get('pkceVerifier')

  if (!code || !state || state !== storedState) {
    return h.redirect('/auth/regulator/login')
  }

  request.yar.clear('oauthState')
  request.yar.clear('oauthNonce')
  request.yar.clear('pkceVerifier')

  if (!storedNonce || !storedVerifier) {
    return h.redirect('/auth/regulator/login')
  }

  const provider = getAzureEntraIdConfig(config)

  let tokenJson
  try {
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: provider.callbackUrl,
        code_verifier: storedVerifier
      })
    })

    if (!tokenResponse.ok) {
      return h.redirect('/auth/regulator/login')
    }

    tokenJson = await tokenResponse.json()
  } catch {
    return h.redirect('/auth/regulator/login')
  }

  const idToken = tokenJson?.id_token
  if (!idToken) {
    return h.redirect('/auth/regulator/login')
  }

  let claims
  try {
    claims = await verifyAzureIdToken(idToken, {
      jwksUri: provider.jwksUri,
      issuer: provider.issuer,
      audience: provider.clientId,
      expectedNonce: storedNonce
    })
  } catch {
    return h.redirect('/auth/regulator/login')
  }

  const user = {
    id: claims.oid ?? claims.sub,
    email: claims.preferred_username ?? claims.email ?? null,
    name: claims.name ?? null,
    userType: 'regulator'
  }

  request.yar.reset()
  request.yar.set('user', user)
  return h.redirect('/')
}

export async function operatorCallbackController(request, h) {
  const { code, state } = request.query
  const storedState = request.yar.get('oauthState')

  if (!code || !state || state !== storedState) {
    return h.redirect('/auth/operator/login')
  }

  request.yar.clear('oauthState')
  request.yar.clear('oauthNonce')

  const provider = getDefraIdConfig(config)
  const { tokenUrl } = await getDefraIdEndpoints(provider.discoveryUrl)

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

  // Defra ID B2C returns all profile claims in the id_token JWT payload.
  // We decode (not verify) the payload — the token was just received over TLS from the token endpoint.
  const payload = JSON.parse(
    Buffer.from(idToken.split('.')[1], 'base64url').toString()
  )

  const user = {
    id: payload.sub,
    email: payload.email,
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    contactId: payload.contactId,
    currentRelationshipId: payload.currentRelationshipId,
    relationships: payload.relationships ?? [],
    roles: payload.roles ?? [],
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
