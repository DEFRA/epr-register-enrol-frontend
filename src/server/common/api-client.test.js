import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { config } from '../../config/config.js'
import { createApiClient } from './api-client.js'

const BASE_URL = 'http://localhost:5000'
const DEFAULT_TIMEOUT = 5000

describe('api-client', () => {
  let client
  let fetchMock
  let abortSignalTimeoutSpy
  let originalFetch

  beforeEach(() => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'api.baseUrl') return BASE_URL
      if (key === 'api.timeout') return DEFAULT_TIMEOUT
      if (key === 'api.sharedSecret') return ''
      return undefined
    })

    originalFetch = global.fetch
    fetchMock = vi.fn()
    global.fetch = fetchMock

    abortSignalTimeoutSpy = vi.spyOn(AbortSignal, 'timeout')

    client = createApiClient()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  test('uses the configured global timeout by default', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })

    await client.get('/things')

    expect(abortSignalTimeoutSpy).toHaveBeenCalledWith(DEFAULT_TIMEOUT)
  })

  test('applies a per-call timeout override when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })

    await client.post('/things', { a: 1 }, { timeout: 20000 })

    expect(abortSignalTimeoutSpy).toHaveBeenCalledWith(20000)
  })

  test('does not leak the timeout option into the fetch request options', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })

    await client.post('/things', { a: 1 }, { timeout: 20000 })

    const [, requestOptions] = fetchMock.mock.calls[0]
    expect(requestOptions.timeout).toBeUndefined()
  })

  test('raises a friendly timeout error when fetch rejects with AbortError', async () => {
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError'
    )
    fetchMock.mockRejectedValue(abortError)

    await expect(client.get('/things')).rejects.toThrow(
      `API request timeout after ${DEFAULT_TIMEOUT}ms`
    )
  })

  test('raises a friendly timeout error when fetch rejects with TimeoutError (AbortSignal.timeout spec behaviour)', async () => {
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError'
    )
    fetchMock.mockRejectedValue(timeoutError)

    await expect(client.get('/things')).rejects.toThrow(
      `API request timeout after ${DEFAULT_TIMEOUT}ms`
    )
  })

  test('friendly TimeoutError message reflects a per-call timeout override', async () => {
    const timeoutError = new DOMException(
      'The operation was aborted due to timeout',
      'TimeoutError'
    )
    fetchMock.mockRejectedValue(timeoutError)

    await expect(
      client.post('/submit', {}, { timeout: 20000 })
    ).rejects.toThrow('API request timeout after 20000ms')
  })

  test('rethrows non-timeout errors unchanged', async () => {
    const otherError = new Error('network down')
    fetchMock.mockRejectedValue(otherError)

    await expect(client.get('/things')).rejects.toThrow('network down')
  })

  test('throws an error with status and response body when the response is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'not found'
    })

    await expect(client.get('/missing')).rejects.toMatchObject({
      status: 404,
      response: 'not found'
    })
  })

  test('redacts an email address embedded in the error response body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () =>
        '{"error":"Invalid contact email: jane.doe@example.com"}'
    })

    await expect(client.get('/things')).rejects.toMatchObject({
      status: 400,
      response: '{"error":"Invalid contact email: [REDACTED]"}'
    })
  })

  test('does not send an Authorization header when no shared secret is configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })

    await client.get('/things')

    const [, requestOptions] = fetchMock.mock.calls[0]
    expect(requestOptions.headers.Authorization).toBeUndefined()
  })

  test('sends the shared secret as a Bearer token when configured', async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'api.baseUrl') return BASE_URL
      if (key === 'api.timeout') return DEFAULT_TIMEOUT
      if (key === 'api.sharedSecret') return 'top-secret'
      return undefined
    })
    client = createApiClient()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })

    await client.get('/things')

    const [, requestOptions] = fetchMock.mock.calls[0]
    expect(requestOptions.headers.Authorization).toBe('Bearer top-secret')
  })
})
