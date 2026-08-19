import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import { isSessionIdle, touchLastActivity } from './session-idle-timeout.js'

function fakeYar(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value)
  }
}

describe('isSessionIdle', () => {
  let yar

  beforeEach(() => {
    vi.useFakeTimers()
    yar = fakeYar()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('returns false when lastActivityAt is undefined (fresh session, never touched)', () => {
    expect(isSessionIdle(yar, 20 * 60 * 1000)).toBe(false)
  })

  test('returns false when lastActivityAt is recent (well within the idle window)', () => {
    const lastActivityAt = Date.now() - 5 * 60 * 1000
    yar.set('lastActivityAt', lastActivityAt)
    expect(isSessionIdle(yar, 20 * 60 * 1000)).toBe(false)
  })

  test('returns true when lastActivityAt is older than the threshold', () => {
    const lastActivityAt = Date.now() - 21 * 60 * 1000
    yar.set('lastActivityAt', lastActivityAt)
    expect(isSessionIdle(yar, 20 * 60 * 1000)).toBe(true)
  })

  test('boundary: exactly at the threshold should be treated as idle (>=)', () => {
    const lastActivityAt = Date.now() - 20 * 60 * 1000
    yar.set('lastActivityAt', lastActivityAt)
    expect(isSessionIdle(yar, 20 * 60 * 1000)).toBe(true)
  })
})

describe('touchLastActivity', () => {
  let yar

  beforeEach(() => {
    vi.useFakeTimers()
    yar = fakeYar()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('sets lastActivityAt to the current time (Date.now()) on the yar object', () => {
    const now = Date.now()
    touchLastActivity(yar)
    expect(yar.get('lastActivityAt')).toBe(now)
  })

  test('overwrites a previous stale lastActivityAt value with a fresh one', () => {
    const initialLastActivityAt = Date.now() - 30 * 60 * 1000
    yar.set('lastActivityAt', initialLastActivityAt)
    vi.advanceTimersByTime(10 * 60 * 1000)
    const now = Date.now()
    touchLastActivity(yar)
    expect(yar.get('lastActivityAt')).toBe(now)
    expect(yar.get('lastActivityAt')).not.toBe(initialLastActivityAt)
  })
})
