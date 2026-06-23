import { config } from '../../config/config.js'
import { persistentStubApiClient } from './persistentStubApiClient.js'

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

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
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

// Real API client — always contacts the backend, ignores api.stubEnabled.
// Use this for features that require a live backend (e.g. file upload).
export const realApiClient = createApiClient()

// Create a singleton instance to be reused throughout the application
export const apiClient = config.get('api.stubEnabled')
  ? persistentStubApiClient
  : createApiClient()
