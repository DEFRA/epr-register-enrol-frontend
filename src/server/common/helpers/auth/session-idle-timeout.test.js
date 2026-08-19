import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  isSessionIdle,
  touchLastActivity,
  yarSessionAuthenticate
} from './session-idle-timeout.js'

function fakeYar(initial = {}) {
  const store = new Map(Object.entries(initial))
  const calls = []
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      calls.push({ op: 'set', key, value })
      store.set(key, value)
    },
    reset: () => {
      calls.push({ op: 'reset' })
      store.clear()
    },
    _calls: calls
  }
}

function mockH() {
  return {
    unauthenticated: vi.fn().mockReturnValue('unauthenticated-result'),
    authenticated: vi.fn().mockReturnValue('authenticated-result')
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

describe('yarSessionAuthenticate', () => {
  test('no user in session: unauthenticated, session not reset', () => {
    const yar = fakeYar()
    const h = mockH()

    const result = yarSessionAuthenticate({ yar }, h)

    expect(h.unauthenticated).toHaveBeenCalledTimes(1)
    expect(h.authenticated).not.toHaveBeenCalled()
    expect(yar._calls.some((c) => c.op === 'reset')).toBe(false)
    expect(result).toBe('unauthenticated-result')
  })

  test('user present, no prior activity (fresh login): authenticates and stamps lastActivityAt', () => {
    const yar = fakeYar({ user: { userType: 'operator' } })
    const h = mockH()

    yarSessionAuthenticate({ yar }, h)

    expect(h.authenticated).toHaveBeenCalledTimes(1)
    expect(h.unauthenticated).not.toHaveBeenCalled()
    expect(yar.get('lastActivityAt')).toEqual(expect.any(Number))
  })

  test('user present, active within idle window: authenticates and refreshes lastActivityAt', () => {
    const staleButWithinWindow = Date.now() - 5 * 60 * 1000
    const yar = fakeYar({
      user: { userType: 'operator' },
      lastActivityAt: staleButWithinWindow
    })
    const h = mockH()

    yarSessionAuthenticate({ yar }, h)

    expect(h.authenticated).toHaveBeenCalledTimes(1)
    expect(h.unauthenticated).not.toHaveBeenCalled()
    expect(yar.get('lastActivityAt')).not.toBe(staleButWithinWindow)
    expect(yar.get('lastActivityAt')).toEqual(expect.any(Number))
  })

  test('user present, idle past the timeout: resets session and returns unauthenticated', () => {
    const idleTimeoutMs = 20 * 60 * 1000
    const expiredAt = Date.now() - (idleTimeoutMs + 1000)
    const yar = fakeYar({
      user: { userType: 'operator' },
      lastActivityAt: expiredAt
    })
    const h = mockH()

    const result = yarSessionAuthenticate({ yar }, h)

    expect(yar._calls.some((c) => c.op === 'reset')).toBe(true)
    expect(h.unauthenticated).toHaveBeenCalledTimes(1)
    expect(h.authenticated).not.toHaveBeenCalled()
    expect(result).toBe('unauthenticated-result')
  })

  test('builds credentials scope from userType and regulatorRole when present', () => {
    const yar = fakeYar({
      user: { userType: 'regulator', regulatorRole: 'regulator-standard' }
    })
    const h = mockH()

    yarSessionAuthenticate({ yar }, h)

    expect(h.authenticated).toHaveBeenCalledWith({
      credentials: {
        userType: 'regulator',
        regulatorRole: 'regulator-standard',
        scope: ['regulator', 'regulator-standard']
      }
    })
  })

  test('builds credentials scope from userType only when regulatorRole absent', () => {
    const yar = fakeYar({ user: { userType: 'operator' } })
    const h = mockH()

    yarSessionAuthenticate({ yar }, h)

    expect(h.authenticated).toHaveBeenCalledWith({
      credentials: {
        userType: 'operator',
        scope: ['operator']
      }
    })
  })
})
