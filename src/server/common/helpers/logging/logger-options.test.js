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
