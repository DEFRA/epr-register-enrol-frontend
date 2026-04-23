/**
 * Reusable API client for calling external APIs.
 * Uses node-fetch to make HTTP requests with configurable base URL and timeout.
 * Supports OAuth2 client credentials authentication with automatic token management.
 */
import fetch from 'node-fetch'
import { config } from '../../config/config.js'

/**
 * Creates an OAuth2 token manager for client credentials flow
 * @returns {Object} Token manager with getAccessToken method
 */
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
    
    const body = {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope && { scope })
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

      try {
        const { accessToken: newToken, expiresIn } = await fetchAccessToken()
        accessToken = newToken
        tokenExpiry = now + expiresIn * 1000
        return accessToken
      } catch (error) {
        // Log the error but allow request to proceed without auth
        console.error(`OAuth2 token fetch failed: ${error.message}`)
        throw error
      }
    },

    clearToken() {
      accessToken = null
      tokenExpiry = null
    }
  }
}

const tokenManager = createTokenManager()

/**
 * Creates an API client instance with configured base URL and timeout
 * @returns {Object} API client with methods for making HTTP requests
 */
export function createApiClient() {
  const baseUrl = config.get('api.baseUrl')
  const timeout = config.get('api.timeout')

  /**
   * Makes an HTTP request to the API
   * @param {string} endpoint - The API endpoint (e.g., '/users', '/data')
   * @param {Object} options - Request options
   * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {Object} options.headers - Additional headers to send
   * @param {*} options.body - Request body (will be JSON stringified if object)
   * @returns {Promise<Object>} The parsed JSON response
   * @throws {Error} If the request fails or response is not OK
   */
  async function makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      ...otherOptions
    } = options

    const url = new URL(endpoint, baseUrl).toString()

    const accessToken = await tokenManager.getAccessToken()

    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers
    }
    if (accessToken) {
      requestHeaders.Authorization = `Bearer ${accessToken}`
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
      if (error.name === 'AbortError') {
        throw new Error(`API request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  return {
    /**
     * GET request
     * @param {string} endpoint - The API endpoint
     * @param {Object} options - Additional request options
     */
    get(endpoint, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'GET' })
    },

    /**
     * POST request
     * @param {string} endpoint - The API endpoint
     * @param {*} body - Request body
     * @param {Object} options - Additional request options
     */
    post(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'POST', body })
    },

    /**
     * PUT request
     * @param {string} endpoint - The API endpoint
     * @param {*} body - Request body
     * @param {Object} options - Additional request options
     */
    put(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'PUT', body })
    },

    /**
     * PATCH request
     * @param {string} endpoint - The API endpoint
     * @param {*} body - Request body
     * @param {Object} options - Additional request options
     */
    patch(endpoint, body, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'PATCH', body })
    },

    /**
     * DELETE request
     * @param {string} endpoint - The API endpoint
     * @param {Object} options - Additional request options
     */
    delete(endpoint, options = {}) {
      return makeRequest(endpoint, { ...options, method: 'DELETE' })
    }
  }
}

// Create a singleton instance to be reused throughout the application
export const apiClient = createApiClient()
