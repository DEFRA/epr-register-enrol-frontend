import { createHash, randomBytes } from 'node:crypto'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import {
  ROLE_REGULATOR_STANDARD,
  ROLE_REGULATOR_SUPPORT_READONLY
} from '../common/helpers/auth/auth-scopes.js'
import { getAzureEntraIdConfig } from '../common/helpers/auth/providers/azure-entra-id.js'
import { verifyAzureIdToken } from '../common/helpers/auth/providers/azure-id-token.js'
import {
  getDefraIdConfig,
  getDefraIdEndpoints
} from '../common/helpers/auth/providers/defra-id.js'
import { verifyDefraIdToken } from '../common/helpers/auth/providers/defra-id-token.js'
import {
  confirmPostLoginRedirect,
  popPostLoginRedirect
} from '../common/helpers/auth/auth-redirect.js'
import { isRegulatorAccessDisabled } from '../common/helpers/auth/regulator-access.js'

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

export function regulatorLoginController(request, h) {
  confirmPostLoginRedirect(request, 'regulator')

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
  confirmPostLoginRedirect(request, 'operator')

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

export async function regulatorCallbackController(request, h) {
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
    return h.redirect('/auth/regulator/login')
  }

  request.yar.clear('oauthState')
  request.yar.clear('oauthNonce')
  request.yar.clear('pkceVerifier')

  if (!storedNonce || !storedVerifier) {
    logWarn(
      request,
      'oauth callback: missing nonce or pkce verifier in session'
    )
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
      logWarn(request, 'oauth callback: token endpoint returned non-2xx', {
        status: tokenResponse.status
      })
      return h.redirect('/auth/regulator/login')
    }

    tokenJson = await tokenResponse.json()
  } catch (err) {
    logWarn(request, 'oauth callback: token endpoint request failed', {
      err
    })
    return h.redirect('/auth/regulator/login')
  }

  const idToken = tokenJson?.id_token
  if (!idToken) {
    logWarn(request, 'oauth callback: token response missing id_token')
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
  } catch (err) {
    logWarn(request, 'oauth callback: id_token verification failed', {
      err
    })
    return h.redirect('/auth/regulator/login')
  }

  // App roles surface on the id_token as a `roles` claim (an array) once
  // assigned to the user in the Enterprise Application.
  const regulatorRoleValue = config.get('auth.azureEntraId.regulatorRoleValue')
  const supportUserRoleValue = config.get(
    'auth.azureEntraId.supportUserRoleValue'
  )
  const claimRoles = Array.isArray(claims.roles) ? claims.roles : []

  let regulatorRole
  if (claimRoles.includes(regulatorRoleValue)) {
    regulatorRole = ROLE_REGULATOR_STANDARD
  } else if (claimRoles.includes(supportUserRoleValue)) {
    regulatorRole = ROLE_REGULATOR_SUPPORT_READONLY
  } else {
    logWarn(
      request,
      'oauth callback: caller missing required regulator or support user role',
      { regulatorRoleValue, supportUserRoleValue }
    )
    return h
      .view('error/access-denied', {
        pageTitle: 'You do not have permission to access this service'
      })
      .code(statusCodes.forbidden)
  }

  const user = {
    id: claims.oid ?? claims.sub,
    email: claims.preferred_username ?? claims.email ?? null,
    name: claims.name ?? null,
    userType: 'regulator',
    regulatorRole
  }

  const redirectTo = popPostLoginRedirect(request, 'regulator', '/')
  request.yar.reset()

  // Store the raw id_token so it can be passed as id_token_hint during
  // federated logout from Entra ID.
  request.yar.set('idToken', idToken)
  request.yar.set('user', user)
  return h.redirect(redirectTo)
}

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

  const redirectTo = popPostLoginRedirect(request, 'operator', '/')

  request.yar.reset()

  // Store the raw id_token so it can be passed as id_token_hint during logout.
  request.yar.set('idToken', idToken)
  request.yar.set('user', user)
  return h.redirect(redirectTo)
}

// --- Logout ---

export async function logoutController(request, h) {
  const user = request.yar.get('user')
  const idToken = request.yar.get('idToken')

  // Federated logout round-trips through this same route (Entra/Defra ID
  // redirect back to post_logout_redirect_uri below) — by then the session,
  // and with it `user`, has already been reset by the first pass. Carry the
  // provider through as a query param on that redirect URI so the fallback
  // below still lands on the right login page, rather than defaulting to
  // operator regardless of who actually signed out.
  const userType =
    user?.userType === 'regulator' || request.query.userType === 'regulator'
      ? 'regulator'
      : 'operator'

  // Only do federated logout when we have an id_token — that means the user
  // authenticated via a real upstream IdP (stub users never get one).
  if (!idToken) {
    request.yar.reset()
    // RA-427: a regulator session created before the flag was switched on
    // can still reach here (logging out doesn't require regulator pages to
    // be reachable) — /auth/regulator/login 404s once disabled, so fall
    // back to the operator login page rather than dead-ending them.
    return h.redirect(
      userType === 'regulator' && !isRegulatorAccessDisabled()
        ? '/auth/regulator/login'
        : '/auth/operator/login'
    )
  }

  let endSessionUrl
  if (userType === 'regulator') {
    ;({ logoutUrl: endSessionUrl } = getAzureEntraIdConfig(config))
  } else {
    const provider = getDefraIdConfig(config)
    ;({ endSessionUrl } = await getDefraIdEndpoints(provider.discoveryUrl))
  }

  // Reset (not clear) the local session before redirecting, so the server-side
  // cache entry is actually dropped rather than just nulling out these two keys.
  // If the user returns to /auth/logout after the IdP signs them out, the
  // session will be empty and we fall through to the redirect above.
  request.yar.reset()

  const params = new URLSearchParams({
    post_logout_redirect_uri: `${config.get('auth.callbackBaseUrl')}/auth/logout?userType=${userType}`
  })
  params.set('id_token_hint', idToken)

  return h.redirect(`${endSessionUrl}?${params}`)
}
