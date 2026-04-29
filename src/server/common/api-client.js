import { config } from '../../config/config.js'

function createTokenManager() {
  let accessToken = null
  let tokenExpiry = null
  const minValidityMs = 30000

  const getTokenConfig = () => ({
    clientId: config.get('api.oauth2.clientCredentials.clientId'),
    clientSecret: config.get('api.oauth2.clientCredentials.clientSecret'),
    tokenUrl: config.get('api.oauth2.clientCredentials.tokenUrl'),
    scope: config.get('api.oauth2.clientCredentials.scope')
  })

  const isConfigured = () => {
    const { clientId, clientSecret, tokenUrl } = getTokenConfig()
    return Boolean(clientId && clientSecret && tokenUrl)
  }

  const fetchAccessToken = async () => {
    const { clientId, clientSecret, tokenUrl, scope } = getTokenConfig()
    console.debug('Fetching new OAuth2 access token for API client', clientId, clientSecret , scope  )
    const body = {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope && { scope })
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `OAuth2 token request failed: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    const tokenResponse = await response.json()
    return {
      accessToken: tokenResponse.access_token,
      expiresIn: tokenResponse.expires_in
    }
  }

  return {
    async getAccessToken() {
      if (!isConfigured()) {
        return null
      }

      const now = Date.now()
      if (accessToken && tokenExpiry && now < tokenExpiry - minValidityMs) {
        return accessToken
      }

      // Propagate token fetch failures — the request cannot proceed without auth.
      const { accessToken: newToken, expiresIn } = await fetchAccessToken()
      accessToken = newToken
      tokenExpiry = now + expiresIn * 1000
      return accessToken
    },

    clearToken() {
      accessToken = null
      tokenExpiry = null
    }
  }
}

export function createApiClient() {
  const baseUrl = config.get('api.baseUrl')
  const timeout = config.get('api.timeout')
  // Each client instance owns its token manager so multiple clients targeting
  // different APIs do not share cached tokens.
  const tokenManager = createTokenManager()

  async function makeRequest(endpoint, options = {}, isRetry = false) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      ...otherOptions
    } = options

    const url = new URL(endpoint, baseUrl).toString()
    const token = await tokenManager.getAccessToken()

    // Caller-supplied headers are applied last so they can override defaults,
    // including Authorization if a different token is needed for this request.
    const requestHeaders = {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers
    }

    const requestOptions = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout),
      ...otherOptions
    }

    if (body) {
      requestOptions.body =
        typeof body === 'string' ? body : JSON.stringify(body)
    }

    try {
      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        // On the first 401 the cached token may have been revoked early.
        // Clear it and retry once with a freshly fetched token.
        if (response.status === 401 && !isRetry) {
          tokenManager.clearToken()
          return makeRequest(endpoint, options, true)
        }

        const errorText = await response.text()
        const error = new Error(
          `API request failed: ${response.status} ${response.statusText}`
        )
        error.status = response.status
        error.response = errorText
        throw error
      }

      return await response.json()
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(`API request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  return {
    get(endpoint, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'GET' })
    },

    post(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'POST', body })
    },

    put(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'PUT', body })
    },

    patch(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'PATCH', body })
    },

    delete(endpoint, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'DELETE' })
    }
  }
}

export const apiClient = createApiClient()
