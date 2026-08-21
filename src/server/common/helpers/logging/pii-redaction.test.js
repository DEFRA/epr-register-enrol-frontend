import { describe, test, expect } from 'vitest'

import {
  REDACTED_VALUE,
  redactEmailAddresses,
  redactedReqSerializer,
  piiSerializers
} from './pii-redaction.js'

describe('#redactEmailAddresses', () => {
  test('redacts a bare email address', () => {
    expect(redactEmailAddresses('person@example.com')).toBe(REDACTED_VALUE)
  })

  test('redacts an email embedded in a JSON error body without eating surrounding punctuation', () => {
    const input = '{"error":"Invalid contact email: jane.doe@example.com"}'

    expect(redactEmailAddresses(input)).toBe(
      '{"error":"Invalid contact email: [REDACTED]"}'
    )
  })

  test('leaves text with no email address untouched', () => {
    expect(redactEmailAddresses('not found')).toBe('not found')
  })

  test('passes through non-string values unchanged', () => {
    expect(redactEmailAddresses(undefined)).toBeUndefined()
    expect(redactEmailAddresses(null)).toBeNull()
  })
})

describe('#redactedReqSerializer', () => {
  test('replaces remoteAddress with the redacted placeholder', () => {
    const stdSerializedReq = {
      id: 'req-1',
      method: 'GET',
      url: '/apply',
      headers: { 'user-agent': 'test-agent' },
      remoteAddress: '203.0.113.5',
      remotePort: 54321
    }

    const result = redactedReqSerializer(stdSerializedReq)

    expect(result.remoteAddress).toBe(REDACTED_VALUE)
  })

  test('leaves non-PII request fields untouched', () => {
    const stdSerializedReq = {
      id: 'req-1',
      method: 'POST',
      url: '/apply',
      headers: { 'user-agent': 'test-agent' },
      remoteAddress: '203.0.113.5',
      remotePort: 54321
    }

    const result = redactedReqSerializer(stdSerializedReq)

    expect(result.id).toBe('req-1')
    expect(result.method).toBe('POST')
    expect(result.url).toBe('/apply')
    expect(result.headers).toEqual({ 'user-agent': 'test-agent' })
    expect(result.remotePort).toBe(54321)
  })

  test('redacts x-forwarded-for and x-real-ip headers when present', () => {
    const stdSerializedReq = {
      id: 'req-1',
      method: 'GET',
      url: '/apply',
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '198.51.100.7',
        'x-real-ip': '198.51.100.7'
      },
      remoteAddress: '10.0.0.5',
      remotePort: 54321
    }

    const result = redactedReqSerializer(stdSerializedReq)

    expect(result.headers['x-forwarded-for']).toBe(REDACTED_VALUE)
    expect(result.headers['x-real-ip']).toBe(REDACTED_VALUE)
    expect(result.headers['user-agent']).toBe('test-agent')
  })

  test('handles a request with no headers object', () => {
    const stdSerializedReq = {
      id: 'req-1',
      method: 'GET',
      url: '/apply',
      remoteAddress: '203.0.113.5',
      remotePort: 54321
    }

    const result = redactedReqSerializer(stdSerializedReq)

    expect(result.headers).toBeUndefined()
  })
})

describe('#piiSerializers.email', () => {
  test('always returns the redacted placeholder', () => {
    expect(piiSerializers.email('person@example.com')).toBe(REDACTED_VALUE)
  })
})
