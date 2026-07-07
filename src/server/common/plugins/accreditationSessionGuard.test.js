import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  shouldGuardPath,
  hasValidSession,
  hasOrganisationAccess,
  accreditationSessionGuard
} from './accreditationSessionGuard.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { config } from '../../../config/config.js'

describe('shouldGuardPath', () => {
  test('returns true for /accreditation/ routes', () => {
    expect(shouldGuardPath('/accreditation/task-list/abc')).toBe(true)
    expect(shouldGuardPath('/accreditation/business-plan/xyz')).toBe(true)
  })

  test('returns true for Welsh /{language}/accreditation/ routes', () => {
    expect(shouldGuardPath('/cy/accreditation/task-list/abc')).toBe(true)
    expect(shouldGuardPath('/cy/accreditation/business-plan/xyz')).toBe(true)
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

describe('hasOrganisationAccess', () => {
  function makeYar(organisationId) {
    return {
      get: vi.fn((key) =>
        key === ACCREDITATION_SESSION_KEYS.organisationId
          ? organisationId
          : null
      )
    }
  }

  const relatedUser = {
    userType: 'operator',
    relationships: ['rel-1:50001:First Org', 'rel-2:50002:Second Org']
  }

  test('returns true when no organisation id is in the session', () => {
    expect(hasOrganisationAccess(makeYar(null), relatedUser)).toBe(true)
  })

  test('returns true when the session org is one the user is related to', () => {
    expect(hasOrganisationAccess(makeYar('50002'), relatedUser)).toBe(true)
  })

  test('returns false when the session org is not one the user is related to', () => {
    expect(hasOrganisationAccess(makeYar('99999'), relatedUser)).toBe(false)
  })

  test('returns false when the user has no relationships', () => {
    expect(
      hasOrganisationAccess(makeYar('50001'), { userType: 'operator' })
    ).toBe(false)
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

  function makeYarWithFlash(accreditationId) {
    return {
      get: vi.fn((key) =>
        key === ACCREDITATION_SESSION_KEYS.accreditationId
          ? accreditationId
          : null
      ),
      flash: vi.fn()
    }
  }

  function runGuard(path, accreditationId) {
    const yar = makeYarWithFlash(accreditationId)
    const request = { path, yar }

    if (!shouldGuardPath(request.path)) return h.continue
    if (!hasValidSession(request.yar)) {
      request.yar.flash(
        'notification',
        'Your session has expired. Please sign in again to continue.'
      )
      return h.redirect('/operator').takeover()
    }
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

  test('accreditation route without session redirects to /operator', () => {
    const result = runGuard('/accreditation/task-list/abc', null)
    expect(h.redirect).toHaveBeenCalledWith('/operator')
    expect(result).toBe('redirect-response')
  })

  test('accreditation route with empty session redirects to /operator', () => {
    runGuard('/accreditation/business-plan/abc', '')
    expect(h.redirect).toHaveBeenCalledWith('/operator')
  })

  test('Welsh accreditation route with valid session passes through', () => {
    const result = runGuard('/cy/accreditation/task-list/abc', 'app-123')
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('Welsh accreditation route without session redirects to /operator', () => {
    const result = runGuard('/cy/accreditation/task-list/abc', null)
    expect(h.redirect).toHaveBeenCalledWith('/operator')
    expect(result).toBe('redirect-response')
  })

  test('writes session-expiry flash before redirecting', () => {
    const yar = makeYarWithFlash(null)
    const request = { path: '/accreditation/task-list/abc', yar }
    if (shouldGuardPath(request.path) && !hasValidSession(request.yar)) {
      request.yar.flash(
        'notification',
        'Your session has expired. Please sign in again to continue.'
      )
      h.redirect('/operator').takeover()
    }
    expect(yar.flash).toHaveBeenCalledWith(
      'notification',
      'Your session has expired. Please sign in again to continue.'
    )
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
      ),
      flash: vi.fn()
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
    expect(h.redirect).toHaveBeenCalledWith('/operator')
  })

  test('registered callback writes flash notification before redirecting', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const yar = makeYar(null)
    callback({ path: '/accreditation/task-list/app-1', yar }, h)
    expect(yar.flash).toHaveBeenCalledWith(
      'notification',
      'Your session has expired. Please sign in again to continue.'
    )
  })

  test('registered callback passes through Welsh accreditation routes with valid session', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = callback(
      { path: '/cy/accreditation/task-list/app-1', yar: makeYar('app-1') },
      h
    )
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('registered callback redirects Welsh accreditation routes with missing session', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    callback(
      { path: '/cy/accreditation/task-list/app-1', yar: makeYar(null) },
      h
    )
    expect(h.redirect).toHaveBeenCalledWith('/operator')
  })

  function makeYarWithOrg(accreditationId, organisationId) {
    return {
      get: vi.fn((key) => {
        if (key === ACCREDITATION_SESSION_KEYS.accreditationId) {
          return accreditationId
        }
        if (key === ACCREDITATION_SESSION_KEYS.organisationId) {
          return organisationId
        }
        return null
      }),
      flash: vi.fn()
    }
  }

  test('registered callback allows access when session org matches user relationship', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = callback(
      {
        path: '/accreditation/task-list/app-1',
        yar: makeYarWithOrg('app-1', '50001'),
        auth: {
          credentials: {
            userType: 'operator',
            relationships: ['rel-1:50001:First Org']
          }
        }
      },
      h
    )
    expect(result).toBe(h.continue)
  })

  test('registered callback throws 403 when session org is not one the user is related to', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/task-list/app-1',
      yar: makeYarWithOrg('app-1', '99999'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50001:First Org']
        }
      }
    }

    let thrown
    try {
      callback(request, h)
    } catch (err) {
      thrown = err
    }

    expect(thrown?.isBoom).toBe(true)
    expect(thrown?.output?.statusCode).toBe(403)
  })
})
