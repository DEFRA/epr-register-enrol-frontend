import { createHash, randomBytes } from 'node:crypto'

import { config } from '../../config/config.js'
import {
  getDefraIdConfig,
  getDefraIdEndpoints
} from '../common/helpers/auth/providers/defra-id.js'
import { verifyDefraIdToken } from '../common/helpers/auth/providers/defra-id-token.js'
import {
  confirmPostLoginRedirect,
  popPostLoginRedirect
} from '../common/helpers/auth/auth-redirect.js'
import {
  markLoginAndNotifyPrevious,
  clearLogin
} from '../common/helpers/auth/concurrent-login.js'

function randomToken(bytes = 32) {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/={1,2}$/, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}

function pkceChallenge(verifier) {
  return createHash('sha256')
    .update(verifier)
    .digest()
    .toString('base64')
    .replace(/={1,2}$/, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}

function logWarn(request, msg, data) {
  request.logger?.warn?.(data ?? {}, msg)
}

// --- Login — redirect to provider ---

export async function operatorLoginController(request, h) {
  confirmPostLoginRedirect(request)

  const provider = getDefraIdConfig(config)
  const { authUrl } = await getDefraIdEndpoints(provider.discoveryUrl)
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  const codeVerifier = randomToken(64)
  const codeChallenge = pkceChallenge(codeVerifier)
  request.yar.set('oauthState', state)
  request.yar.set('oauthNonce', nonce)
  request.yar.set('pkceVerifier', codeVerifier)

  const params = new URLSearchParams({
    client_id: provider.clientId,
    serviceId: provider.serviceId,
    response_type: 'code',
    redirect_uri: provider.callbackUrl,
    scope: provider.scopes.join(' '),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })

  return h.redirect(`${authUrl}?${params}`)
}

// --- Callbacks — exchange code for session ---

export async function operatorCallbackController(request, h) {
  const { code, state } = request.query
  const storedState = request.yar.get('oauthState')
  const storedNonce = request.yar.get('oauthNonce')
  const storedVerifier = request.yar.get('pkceVerifier')

  if (!code || !state || state !== storedState) {
    logWarn(request, 'oauth callback: state mismatch or missing code', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      stateMatches: state === storedState
    })
    return h.redirect('/auth/operator/login')
  }

  request.yar.clear('oauthState')
  request.yar.clear('oauthNonce')
  request.yar.clear('pkceVerifier')

  if (!storedNonce || !storedVerifier) {
    logWarn(
      request,
      'oauth callback: missing nonce or pkce verifier in session'
    )
    return h.redirect('/auth/operator/login')
  }

  const provider = getDefraIdConfig(config)
  const { tokenUrl, jwksUri, issuer } = await getDefraIdEndpoints(
    provider.discoveryUrl
  )

  let tokenJson
  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: provider.callbackUrl,
        scope: provider.scopes.join(' '),
        code_verifier: storedVerifier
      })
    })

    if (!tokenResponse.ok) {
      logWarn(request, 'oauth callback: token endpoint returned non-2xx', {
        status: tokenResponse.status
      })
      return h.redirect('/auth/operator/login')
    }

    tokenJson = await tokenResponse.json()
  } catch (err) {
    logWarn(request, 'oauth callback: token endpoint request failed', {
      err
    })
    return h.redirect('/auth/operator/login')
  }

  const idToken = tokenJson?.id_token

  if (!idToken) {
    logWarn(request, 'oauth callback: token response missing id_token')
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
  } catch (err) {
    logWarn(request, 'oauth callback: id_token verification failed', {
      err
    })
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

  const redirectTo = popPostLoginRedirect(request, '/')

  request.yar.reset()

  // Store the raw id_token so it can be passed as id_token_hint during logout.
  request.yar.set('idToken', idToken)
  request.yar.set('user', user)
  // RA-462: stamp this session and, if the identity already had one, arm the
  // "you were already signed in elsewhere" note on this new session.
  await markLoginAndNotifyPrevious(request, user.id)
  return h.redirect(redirectTo)
}

// --- Logout ---

export async function logoutController(request, h) {
  const user = request.yar.get('user')
  const idToken = request.yar.get('idToken')

  // RA-462: drop this identity's registry entry so a later request from a
  // still-live parallel session doesn't raise a "new sign-in" alert about a
  // login that has since been signed out.
  if (user?.id) {
    await clearLogin(request, user.id)
  }

  // Only do federated logout when we have an id_token — that means the user
  // authenticated via Defra ID (stub users never get one).
  if (!idToken) {
    request.yar.reset()
    return h.redirect('/auth/operator/login')
  }

  const provider = getDefraIdConfig(config)
  const { endSessionUrl } = await getDefraIdEndpoints(provider.discoveryUrl)

  // Reset (not clear) the local session before redirecting, so the server-side
  // cache entry is actually dropped rather than just nulling out these two keys.
  // If the user returns to /auth/logout after the IdP signs them out, the
  // session will be empty and we fall through to the redirect above.
  request.yar.reset()

  const params = new URLSearchParams({
    // Kept as `?userType=operator` so the post_logout_redirect_uri sent to
    // Defra ID is byte-for-byte what it was before regulator sign-in was
    // removed (an IdP may match it exactly against its registered URIs).
    post_logout_redirect_uri: `${config.get('auth.callbackBaseUrl')}/auth/logout?userType=operator`
  })
  params.set('id_token_hint', idToken)

  return h.redirect(`${endSessionUrl}?${params}`)
}
