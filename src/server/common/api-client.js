import { config } from '../../config/config.js'
import { redactEmailAddresses } from './helpers/logging/pii-redaction.js'
import { persistentStubApiClient } from './persistentStubApiClient.js'

/**
 * Creates an API client instance with configured base URL and timeout
 * @returns {Object} API client with methods for making HTTP requests
 */
export function createApiClient() {
  const baseUrl = config.get('api.baseUrl')
  const timeout = config.get('api.timeout')
  const sharedSecret = config.get('api.sharedSecret')

  /**
   * Makes an HTTP request to the API
   * @param {string} endpoint - The API endpoint (e.g., '/users', '/data')
   * @param {Object} options - Request options
   * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {Object} options.headers - Additional headers to send
   * @param {*} options.body - Request body (will be JSON stringified if object)
   * @param {number} [options.timeout] - Per-call timeout in ms, overriding the configured api.timeout default
   * @returns {Promise<Object>} The parsed JSON response
   * @throws {Error} If the request fails or response is not OK
   */
  async function makeRequest(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      timeout: requestTimeout,
      ...otherOptions
    } = options

    const effectiveTimeout = requestTimeout ?? timeout

    const url = new URL(endpoint, baseUrl).toString()

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(sharedSecret ? { Authorization: `Bearer ${sharedSecret}` } : {}),
        ...headers
      },
      signal: AbortSignal.timeout(effectiveTimeout),
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
        // Redacted here, at the single point this raw body is first
        // captured, so every downstream consumer - including plain string
        // interpolation into a log message, which no pino serializer can
        // see - gets the safe version rather than the raw API response.
        error.response = redactEmailAddresses(errorText)
        throw error
      }

      return await response.json()
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new Error(`API request timeout after ${effectiveTimeout}ms`)
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

// Real API client — always contacts the backend, ignores api.stubEnabled.
// Use this for features that require a live backend (e.g. file upload).
export const realApiClient = createApiClient()

// Create a singleton instance to be reused throughout the application
export const apiClient = config.get('api.stubEnabled')
  ? persistentStubApiClient
  : createApiClient()
