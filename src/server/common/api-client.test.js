import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn()
  }
}))

const withOAuth2 = {
  'api.baseUrl': 'http://localhost:5000',
  'api.timeout': 5000,
  'api.oauth2.clientCredentials.clientId': 'test-client-id',
  'api.oauth2.clientCredentials.clientSecret': 'test-client-secret',
  'api.oauth2.clientCredentials.tokenUrl': 'http://localhost:5000/token',
  'api.oauth2.clientCredentials.scope': 'read write'
}

const withoutOAuth2 = {
  ...withOAuth2,
  'api.oauth2.clientCredentials.clientId': '',
  'api.oauth2.clientCredentials.clientSecret': '',
  'api.oauth2.clientCredentials.tokenUrl': ''
}

const withoutScope = {
  ...withOAuth2,
  'api.oauth2.clientCredentials.scope': ''
}

const tokenResponse = (token = 'mock-token', expiresIn = 3600) => ({
  ok: true,
  json: () => Promise.resolve({ access_token: token, expires_in: expiresIn }),
  text: () => Promise.resolve('')
})

const apiResponse = (data) => ({
  ok: true,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data))
})

const errorResponse = (status, statusText, body = 'error detail') => ({
  ok: false,
  status,
  statusText,
  text: () => Promise.resolve(body),
  json: () => Promise.resolve({})
})

async function setupModule(configValues) {
  vi.resetModules()
  const { config } = await import('../../config/config.js')
  config.get.mockImplementation((key) => configValues[key])
  const { createApiClient } = await import('./api-client.js')
  return createApiClient
}

describe('#createApiClient', () => {
  let fetchMock
  let createApiClient

  beforeEach(async () => {
    fetchMock = vi.spyOn(global, 'fetch')
    createApiClient = await setupModule(withOAuth2)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OAuth2 token management', () => {
    test('fetches an access token on the first request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/token')
      expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    })

    test('sends the correct client credentials grant body', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      const tokenBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(tokenBody).toEqual({
        grant_type: 'client_credentials',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        scope: 'read write'
      })
    })

    test('sends Content-Type application/json on token request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe(
        'application/json'
      )
    })

    test('attaches the access token as a Bearer Authorization header', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse('my-access-token'))
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        'Bearer my-access-token'
      )
    })

    test('caller-supplied Authorization header overrides the OAuth2 token', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse('oauth-token'))
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data', { headers: { Authorization: 'Bearer caller-token' } })

      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
        'Bearer caller-token'
      )
    })

    test('caches the token and reuses it for subsequent requests', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse('cached-token', 3600))
        .mockResolvedValue(apiResponse({}))

      const client = createApiClient()
      await client.get('/first')
      await client.get('/second')

      // 1 token fetch + 2 API calls
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
        'Bearer cached-token'
      )
    })

    test('refreshes the token when it is within 30s of expiry', async () => {
      vi.useFakeTimers()

      fetchMock
        .mockResolvedValueOnce(tokenResponse('first-token', 60))
        .mockResolvedValueOnce(apiResponse({}))
        .mockResolvedValueOnce(tokenResponse('second-token', 3600))
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/first')

      vi.advanceTimersByTime(35000)

      await client.get('/second')

      expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:5000/token')
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe(
        'Bearer second-token'
      )

      vi.useRealTimers()
    })

    test('does not refresh a token that is still well within its validity window', async () => {
      vi.useFakeTimers()

      fetchMock
        .mockResolvedValueOnce(tokenResponse('valid-token', 3600))
        .mockResolvedValue(apiResponse({}))

      const client = createApiClient()
      await client.get('/first')

      vi.advanceTimersByTime(10000)

      await client.get('/second')

      // Still only 1 token fetch
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:5000/token')
      expect(fetchMock.mock.calls[2][0]).not.toBe('http://localhost:5000/token')

      vi.useRealTimers()
    })

    test('omits scope from the token request when scope is not configured', async () => {
      createApiClient = await setupModule(withoutScope)
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      const tokenBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(tokenBody).not.toHaveProperty('scope')
    })

    test('throws when the token endpoint returns a non-OK response', async () => {
      fetchMock.mockResolvedValueOnce(
        errorResponse(401, 'Unauthorized', 'invalid_client')
      )

      const client = createApiClient()
      await expect(client.get('/data')).rejects.toThrow(
        'OAuth2 token request failed: 401 Unauthorized - invalid_client'
      )
    })

    test('does not call the token endpoint when OAuth2 is not configured', async () => {
      createApiClient = await setupModule(withoutOAuth2)
      fetchMock.mockResolvedValueOnce(apiResponse({ result: 'ok' }))

      const client = createApiClient()
      await client.get('/data')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).not.toContain('token')
    })

    test('does not attach an Authorization header when OAuth2 is not configured', async () => {
      createApiClient = await setupModule(withoutOAuth2)
      fetchMock.mockResolvedValueOnce(apiResponse({}))

      const client = createApiClient()
      await client.get('/data')

      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
    })
  })

  describe('401 retry', () => {
    test('retries once with a fresh token on a 401 response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse('first-token'))
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(tokenResponse('second-token'))
        .mockResolvedValueOnce(apiResponse({ ok: true }))

      const client = createApiClient()
      const result = await client.get('/secure')

      // token, 401 response, new token, success response
      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:5000/token')
      expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe(
        'Bearer second-token'
      )
      expect(result).toEqual({ ok: true })
    })

    test('does not retry a second time if the retried request also returns 401', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(tokenResponse('second-token'))
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))

      const client = createApiClient()
      const err = await client.get('/secure').catch((e) => e)

      expect(fetchMock).toHaveBeenCalledTimes(4)
      expect(err.status).toBe(401)
    })
  })

  describe('HTTP methods', () => {
    beforeEach(() => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValue(apiResponse({ ok: true }))
    })

    test('GET sends a GET request to the correct URL', async () => {
      const client = createApiClient()
      const result = await client.get('/organisations')

      expect(fetchMock.mock.calls[1][0]).toBe(
        'http://localhost:5000/organisations'
      )
      expect(fetchMock.mock.calls[1][1].method).toBe('GET')
      expect(result).toEqual({ ok: true })
    })

    test('POST sends a POST request with a JSON-serialised body', async () => {
      const client = createApiClient()
      await client.post('/items', { name: 'widget', count: 3 })

      const apiCall = fetchMock.mock.calls[1]
      expect(apiCall[1].method).toBe('POST')
      expect(JSON.parse(apiCall[1].body)).toEqual({ name: 'widget', count: 3 })
    })

    test('POST passes a string body through without serialising', async () => {
      const client = createApiClient()
      await client.post('/items', 'raw-string-body')

      expect(fetchMock.mock.calls[1][1].body).toBe('raw-string-body')
    })

    test('PUT sends a PUT request with a body', async () => {
      const client = createApiClient()
      await client.put('/items/1', { name: 'updated' })

      expect(fetchMock.mock.calls[1][1].method).toBe('PUT')
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        name: 'updated'
      })
    })

    test('PATCH sends a PATCH request with a body', async () => {
      const client = createApiClient()
      await client.patch('/items/1', { name: 'patched' })

      expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    })

    test('DELETE sends a DELETE request', async () => {
      const client = createApiClient()
      await client.delete('/items/1')

      expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
    })
  })

  describe('request headers', () => {
    beforeEach(() => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValue(apiResponse({}))
    })

    test('sets Content-Type application/json when the request has a body', async () => {
      const client = createApiClient()
      await client.post('/data', { key: 'value' })

      expect(fetchMock.mock.calls[1][1].headers['Content-Type']).toBe(
        'application/json'
      )
    })

    test('does not set Content-Type on GET requests', async () => {
      const client = createApiClient()
      await client.get('/data')

      expect(
        fetchMock.mock.calls[1][1].headers['Content-Type']
      ).toBeUndefined()
    })

    test('does not set Content-Type on DELETE requests', async () => {
      const client = createApiClient()
      await client.delete('/data')

      expect(
        fetchMock.mock.calls[1][1].headers['Content-Type']
      ).toBeUndefined()
    })

    test('merges caller-supplied headers with the defaults', async () => {
      const client = createApiClient()
      await client.post('/data', { x: 1 }, { headers: { 'X-Trace-Id': 'abc-123' } })

      const { headers } = fetchMock.mock.calls[1][1]
      expect(headers['X-Trace-Id']).toBe('abc-123')
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('URL construction', () => {
    beforeEach(() => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValue(apiResponse({}))
    })

    test('joins baseUrl and endpoint correctly', async () => {
      const client = createApiClient()
      await client.get('/organisation')

      expect(fetchMock.mock.calls[1][0]).toBe(
        'http://localhost:5000/organisation'
      )
    })

    test('preserves query parameters on the endpoint', async () => {
      const client = createApiClient()
      await client.get('/items?page=2&limit=20')

      expect(fetchMock.mock.calls[1][0]).toBe(
        'http://localhost:5000/items?page=2&limit=20'
      )
    })
  })

  describe('error handling', () => {
    test('throws with status and response body on a non-OK API response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(errorResponse(404, 'Not Found', 'no such resource'))

      const client = createApiClient()
      const err = await client.get('/missing').catch((e) => e)

      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe('API request failed: 404 Not Found')
      expect(err.status).toBe(404)
      expect(err.response).toBe('no such resource')
    })

    test('throws on a 500 server error', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))

      const client = createApiClient()
      await expect(client.get('/data')).rejects.toThrow(
        'API request failed: 500 Internal Server Error'
      )
    })

    test('throws a timeout message when fetch rejects with AbortError', async () => {
      const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(abort)

      const client = createApiClient()
      await expect(client.get('/data')).rejects.toThrow(
        'API request timeout after 5000ms'
      )
    })

    test('throws a timeout message when fetch rejects with TimeoutError', async () => {
      const timeout = Object.assign(new Error('timed out'), {
        name: 'TimeoutError'
      })
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(timeout)

      const client = createApiClient()
      await expect(client.get('/data')).rejects.toThrow(
        'API request timeout after 5000ms'
      )
    })

    test('re-throws generic network errors unchanged', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockRejectedValueOnce(new Error('Network failure'))

      const client = createApiClient()
      await expect(client.get('/data')).rejects.toThrow('Network failure')
    })
  })

  describe('exported apiClient singleton', () => {
    test('exposes the expected HTTP method functions', async () => {
      vi.resetModules()
      const { config } = await import('../../config/config.js')
      config.get.mockImplementation((key) => withOAuth2[key])
      const { apiClient } = await import('./api-client.js')

      expect(typeof apiClient.get).toBe('function')
      expect(typeof apiClient.post).toBe('function')
      expect(typeof apiClient.put).toBe('function')
      expect(typeof apiClient.patch).toBe('function')
      expect(typeof apiClient.delete).toBe('function')
    })
  })
})
