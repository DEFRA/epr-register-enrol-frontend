import { describe, test, expect } from 'vitest'

import { config } from './config.js'

describe('session.idleTimeoutMs config', () => {
  test('defaults to 20 minutes (1200000ms)', () => {
    expect(config.get('session.idleTimeoutMs')).toBe(1200000)
  })

  test('is a Number format, not sensitive', () => {
    const serialised = JSON.parse(config.toString())
    expect(typeof serialised.session.idleTimeoutMs).toBe('number')
  })
})
