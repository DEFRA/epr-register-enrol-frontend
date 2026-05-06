import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  shouldGuardPath,
  hasValidSession,
  accreditationSessionGuard
} from './accreditationSessionGuard.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { config } from '../../../config/config.js'

describe('shouldGuardPath', () => {
  test('returns true for /accreditation/ routes', () => {
    expect(shouldGuardPath('/accreditation/task-list/abc')).toBe(true)
    expect(shouldGuardPath('/accreditation/business-plan/xyz')).toBe(true)
  })

  test('returns false for non-accreditation routes', () => {
    expect(shouldGuardPath('/')).toBe(false)
    expect(shouldGuardPath('/operator-accreditation')).toBe(false)
    expect(shouldGuardPath('/health')).toBe(false)
  })
})

describe('hasValidSession', () => {
  function makeYar(accreditationId) {
    return {
      get: vi.fn((key) =>
        key === ACCREDITATION_SESSION_KEYS.accreditationId
          ? accreditationId
          : null
      )
    }
  }

  test('returns true when accreditationId is present in session', () => {
    expect(hasValidSession(makeYar('app-123'))).toBe(true)
  })

  test('returns false when accreditationId is null', () => {
    expect(hasValidSession(makeYar(null))).toBe(false)
  })

  test('returns false when accreditationId is undefined', () => {
    expect(hasValidSession(makeYar(undefined))).toBe(false)
  })

  test('returns false when accreditationId is empty string', () => {
    expect(hasValidSession(makeYar(''))).toBe(false)
  })
})

describe('guard handler behaviour', () => {
  let h

  beforeEach(() => {
    h = {
      continue: Symbol('continue'),
      redirect: vi.fn().mockReturnValue({
        takeover: vi.fn().mockReturnValue('redirect-response')
      })
    }
  })

  function runGuard(path, accreditationId) {
    const request = {
      path,
      yar: {
        get: vi.fn((key) =>
          key === ACCREDITATION_SESSION_KEYS.accreditationId
            ? accreditationId
            : null
        )
      }
    }

    if (!shouldGuardPath(request.path)) return h.continue
    if (!hasValidSession(request.yar)) return h.redirect('/').takeover()
    return h.continue
  }

  test('non-accreditation route passes through', () => {
    const result = runGuard('/', 'app-123')
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('accreditation route with valid session passes through', () => {
    const result = runGuard('/accreditation/task-list/abc', 'app-123')
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('accreditation route without session redirects to /', () => {
    const result = runGuard('/accreditation/task-list/abc', null)
    expect(h.redirect).toHaveBeenCalledWith('/')
    expect(result).toBe('redirect-response')
  })

  test('accreditation route with empty session redirects to /', () => {
    runGuard('/accreditation/business-plan/abc', '')
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})

describe('accreditationSessionGuard plugin registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeYar(accreditationId) {
    return {
      get: vi.fn((key) =>
        key === ACCREDITATION_SESSION_KEYS.accreditationId
          ? accreditationId
          : null
      )
    }
  }

  function makeH() {
    return {
      continue: Symbol('continue'),
      redirect: vi
        .fn()
        .mockReturnValue({ takeover: vi.fn().mockReturnValue('redirect') })
    }
  }

  function registerAndGetCallback() {
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'isTest' ? false : undefined
    )
    const mockServer = { ext: vi.fn() }
    accreditationSessionGuard.plugin.register(mockServer)
    return mockServer.ext.mock.calls[0][1]
  }

  test('registers onPreHandler when not in test mode', () => {
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'isTest' ? false : undefined
    )
    const mockServer = { ext: vi.fn() }
    accreditationSessionGuard.plugin.register(mockServer)
    expect(mockServer.ext).toHaveBeenCalledWith(
      'onPreHandler',
      expect.any(Function)
    )
  })

  test('skips registering onPreHandler when in test mode', () => {
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'isTest' ? true : undefined
    )
    const mockServer = { ext: vi.fn() }
    accreditationSessionGuard.plugin.register(mockServer)
    expect(mockServer.ext).not.toHaveBeenCalled()
  })

  test('registered callback passes through non-accreditation routes', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = callback({ path: '/health', yar: makeYar('app-1') }, h)
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('registered callback passes through accreditation routes with valid session', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = callback(
      { path: '/accreditation/task-list/app-1', yar: makeYar('app-1') },
      h
    )
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('registered callback redirects accreditation routes with missing session', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    callback({ path: '/accreditation/task-list/app-1', yar: makeYar(null) }, h)
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})
