import { Writable } from 'node:stream'

import { pino } from 'pino'
import { describe, test, expect, vi } from 'vitest'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

describe('#loggerOptions.mixin', () => {
  test('includes a trace id when one is available', async () => {
    const { getTraceId } = await import('@defra/hapi-tracing')
    getTraceId.mockReturnValue('trace-abc-123')
    const { loggerOptions } = await import('./logger-options.js')

    expect(loggerOptions.mixin()).toEqual({ trace: { id: 'trace-abc-123' } })
  })

  test('omits trace when no trace id is available', async () => {
    const { getTraceId } = await import('@defra/hapi-tracing')
    getTraceId.mockReturnValue(undefined)
    const { loggerOptions } = await import('./logger-options.js')

    expect(loggerOptions.mixin()).toEqual({})
  })
})

describe('#loggerOptions.serializers', () => {
  function captureLoggedLines(serializers) {
    const lines = []
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(chunk.toString()))
        callback()
      }
    })
    return { logger: pino({ serializers }, destination), lines }
  }

  test('redacts remoteAddress and forwarded-IP headers in real pino output', async () => {
    const { loggerOptions } = await import('./logger-options.js')
    const { logger, lines } = captureLoggedLines(loggerOptions.serializers)

    logger.info({
      req: {
        method: 'GET',
        url: '/apply',
        headers: { 'x-forwarded-for': '198.51.100.7' },
        remoteAddress: '203.0.113.5',
        remotePort: 54321
      }
    })

    expect(lines[0].req.remoteAddress).toBe('[REDACTED]')
    expect(lines[0].req.headers['x-forwarded-for']).toBe('[REDACTED]')
  })

  test('redacts an email field in real pino output', async () => {
    const { loggerOptions } = await import('./logger-options.js')
    const { logger, lines } = captureLoggedLines(loggerOptions.serializers)

    logger.info({ email: 'person@example.com' })

    expect(lines[0].email).toBe('[REDACTED]')
  })
})
