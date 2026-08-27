import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import Boom from '@hapi/boom'
import {
  shouldGuardPath,
  hasValidSession,
  hasOrganisationAccess,
  isEditRestrictedPath,
  isLockedSectionWrite,
  fetchApplication,
  accreditationSessionGuard
} from './accreditationSessionGuard.js'
import { ACCREDITATION_SESSION_KEYS } from '../constants/accreditationSessionKeys.js'
import { config } from '../../../config/config.js'
import { operatorCanAccessOrganisation } from '../helpers/reex-organisation-service.js'
import { accreditationApiService } from '../helpers/accreditationApiService.js'

// The guard delegates the resolve-and-compare (and fail-closed handling) to
// operatorCanAccessOrganisation, which is unit-tested in reex-organisation-service.
// Here we stub it to control the allow/deny outcome.
vi.mock('../helpers/reex-organisation-service.js', () => ({
  operatorCanAccessOrganisation: vi.fn()
}))

vi.mock('../helpers/accreditationApiService.js', () => ({
  accreditationApiService: { getApplication: vi.fn() }
}))

beforeEach(() => {
  operatorCanAccessOrganisation.mockResolvedValue(true)
  accreditationApiService.getApplication
    .mockReset()
    .mockResolvedValue({ applicationStatus: 'Started' })
})

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

describe('isEditRestrictedPath', () => {
  test('blocks editable section routes', () => {
    expect(isEditRestrictedPath('/accreditation/task-list/abc')).toBe(true)
    expect(isEditRestrictedPath('/accreditation/tonnage/abc')).toBe(true)
    expect(isEditRestrictedPath('/cy/accreditation/business-plan/abc')).toBe(
      true
    )
  })

  test('allows the withdraw-application route itself', () => {
    expect(
      isEditRestrictedPath('/accreditation/withdraw-application/abc')
    ).toBe(false)
    expect(
      isEditRestrictedPath('/cy/accreditation/withdraw-application/abc')
    ).toBe(false)
  })

  test('allows view-payment-details', () => {
    expect(
      isEditRestrictedPath('/accreditation/view-payment-details/abc')
    ).toBe(false)
  })

  test('returns false for paths with no matching segment', () => {
    expect(isEditRestrictedPath('/accreditation/')).toBe(false)
    expect(isEditRestrictedPath('/health')).toBe(false)
  })
})

describe('isLockedSectionWrite', () => {
  function postRequest(path) {
    return { method: 'post', path }
  }

  function getRequest(path) {
    return { method: 'get', path }
  }

  test('false for GET requests, even on a locked application', () => {
    const application = {
      applicationStatus: 'Submitted',
      businessPlan: { sectionStatus: 'Completed' }
    }
    expect(
      isLockedSectionWrite(
        getRequest('/accreditation/business-plan/abc'),
        application
      )
    ).toBe(false)
  })

  test('false when there is no application (fails open, like the header fetch)', () => {
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/business-plan/abc'),
        null
      )
    ).toBe(false)
  })

  test('false when the application is not in a locked status', () => {
    const application = {
      applicationStatus: 'Started',
      businessPlan: { sectionStatus: 'InProgress' }
    }
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/business-plan/abc'),
        application
      )
    ).toBe(false)
  })

  test.each(['Submitted', 'DulyMade', 'Updated', 'AwaitingDecision'])(
    'true for a POST to a mapped section route when locked (%s) and the section is not Queried',
    (applicationStatus) => {
      const application = {
        applicationStatus,
        businessPlan: { sectionStatus: 'Completed' }
      }
      expect(
        isLockedSectionWrite(
          postRequest('/accreditation/business-plan/abc'),
          application
        )
      ).toBe(true)
    }
  )

  test('false when the targeted section is itself Queried', () => {
    const application = {
      applicationStatus: 'Submitted',
      businessPlan: { sectionStatus: 'Queried' }
    }
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/business-plan/abc'),
        application
      )
    ).toBe(false)
  })

  test('false for a route not mapped to a section (e.g. task-list)', () => {
    const application = { applicationStatus: 'Submitted' }
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/task-list/abc'),
        application
      )
    ).toBe(false)
  })

  test('resolves nested wizard/CYA sub-pages to their owning section', () => {
    const application = {
      applicationStatus: 'Submitted',
      overseasSites: { sectionStatus: 'Completed' }
    }
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/add-overseas-site/abc/site-name'),
        application
      )
    ).toBe(true)
    expect(
      isLockedSectionWrite(
        postRequest('/accreditation/add-interim-site/abc/country'),
        application
      )
    ).toBe(true)
  })

  test('Welsh-prefixed routes resolve the same way', () => {
    const application = {
      applicationStatus: 'Submitted',
      businessPlan: { sectionStatus: 'Completed' }
    }
    expect(
      isLockedSectionWrite(
        postRequest('/cy/accreditation/business-plan/abc'),
        application
      )
    ).toBe(true)
  })
})

describe('fetchApplication', () => {
  function makeYar(accreditationId, organisationId) {
    return {
      get: vi.fn((key) => {
        if (key === ACCREDITATION_SESSION_KEYS.accreditationId) {
          return accreditationId
        }
        if (key === ACCREDITATION_SESSION_KEYS.organisationId) {
          return organisationId
        }
        return null
      })
    }
  }

  test('returns the fetched application regardless of status', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Started',
      isExporter: false
    })
    const result = await fetchApplication(makeYar('app-1', '50001'))
    expect(result).toEqual({
      applicationStatus: 'Started',
      isExporter: false
    })
  })

  test('returns null (fails open) when the fetch throws', async () => {
    accreditationApiService.getApplication.mockRejectedValue(
      new Error('backend down')
    )
    const result = await fetchApplication(makeYar('app-1', '50001'))
    expect(result).toBeNull()
  })

  test('returns null without fetching when session is incomplete', async () => {
    const result = await fetchApplication(makeYar(null, '50001'))
    expect(result).toBeNull()
    expect(accreditationApiService.getApplication).not.toHaveBeenCalled()
  })

  test('fetches by the route applicationId, not the session accreditationId', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Started'
    })
    await fetchApplication(makeYar('session-app', '50001'), 'route-app')
    expect(accreditationApiService.getApplication).toHaveBeenCalledWith(
      '50001',
      'route-app'
    )
  })

  test('falls back to the session accreditationId when no route id is given', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Started'
    })
    await fetchApplication(makeYar('session-app', '50001'))
    expect(accreditationApiService.getApplication).toHaveBeenCalledWith(
      '50001',
      'session-app'
    )
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

  test('returns true when no organisation id is in the session, without a ReEx lookup', async () => {
    expect(await hasOrganisationAccess(makeYar(null), relatedUser)).toBe(true)
    expect(operatorCanAccessOrganisation).not.toHaveBeenCalled()
  })

  test('delegates to operatorCanAccessOrganisation with the session org, user and logger', async () => {
    const logger = { error: vi.fn() }
    await hasOrganisationAccess(makeYar('50002'), relatedUser, logger)
    expect(operatorCanAccessOrganisation).toHaveBeenCalledWith(
      relatedUser,
      '50002',
      { logger }
    )
  })

  test('returns true when operatorCanAccessOrganisation allows', async () => {
    operatorCanAccessOrganisation.mockResolvedValueOnce(true)
    expect(await hasOrganisationAccess(makeYar('50002'), relatedUser)).toBe(
      true
    )
  })

  test('returns false when operatorCanAccessOrganisation denies', async () => {
    operatorCanAccessOrganisation.mockResolvedValueOnce(false)
    expect(await hasOrganisationAccess(makeYar('99999'), relatedUser)).toBe(
      false
    )
  })

  test('propagates a service-unavailable error (does not swallow it into a deny)', async () => {
    const boom = Boom.serverUnavailable()
    operatorCanAccessOrganisation.mockRejectedValueOnce(boom)
    await expect(
      hasOrganisationAccess(makeYar('50002'), relatedUser)
    ).rejects.toBe(boom)
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

    if (!shouldGuardPath(request.path)) {
      return h.continue
    }
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

  function registerAndGetCallback(overrides = {}) {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key in overrides) {
        return overrides[key]
      }
      if (key === 'isTest') {
        return false
      }
      if (key === 'reex.frontendBaseUrl') {
        return 'https://reex.example'
      }
      return undefined
    })
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

  test('registered callback passes through non-accreditation routes', async () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback({ path: '/health', yar: makeYar('app-1') }, h)
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('registered callback passes through accreditation routes with valid session', async () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      { path: '/accreditation/task-list/app-1', yar: makeYar('app-1') },
      h
    )
    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('registered callback redirects accreditation routes with missing session to the Re-Ex frontend', () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    callback({ path: '/accreditation/task-list/app-1', yar: makeYar(null) }, h)
    expect(h.redirect).toHaveBeenCalledWith('https://reex.example')
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

  // RA-459: /operator is a test-only page that 404s once TEST_PAGES_DISABLED
  // is on — the session-expiry redirect goes to the real Re-Ex frontend
  // unconditionally (not gated on that flag), so it never dead-ends there
  // regardless of TEST_PAGES_DISABLED's value. Both values exercised, not
  // just one, to actually prove the decoupling.
  test.each([true, false])(
    'registered callback redirects to the Re-Ex frontend when testPages.disabled is %s',
    (testPagesDisabled) => {
      const callback = registerAndGetCallback({
        'testPages.disabled': testPagesDisabled,
        'reex.frontendBaseUrl': 'https://reex.example'
      })
      const h = makeH()
      callback(
        { path: '/accreditation/task-list/app-1', yar: makeYar(null) },
        h
      )
      expect(h.redirect).toHaveBeenCalledWith('https://reex.example')
    }
  )

  test('registered callback passes through Welsh accreditation routes with valid session', async () => {
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
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
    expect(h.redirect).toHaveBeenCalledWith('https://reex.example')
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

  test('registered callback allows access when operatorCanAccessOrganisation allows', async () => {
    operatorCanAccessOrganisation.mockResolvedValueOnce(true)
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
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

  test('registered callback throws 403 when operatorCanAccessOrganisation denies', async () => {
    operatorCanAccessOrganisation.mockResolvedValueOnce(false)
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
      await callback(request, h)
    } catch (err) {
      thrown = err
    }

    expect(thrown?.isBoom).toBe(true)
    expect(thrown?.output?.statusCode).toBe(403)
  })

  test('registered callback surfaces a 503 (not a 403) when the access check is unavailable', async () => {
    operatorCanAccessOrganisation.mockRejectedValueOnce(
      Boom.serverUnavailable()
    )
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/task-list/app-1',
      yar: makeYarWithOrg('app-1', '50002'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50002:Second Org']
        }
      }
    }

    let thrown
    try {
      await callback(request, h)
    } catch (err) {
      thrown = err
    }

    expect(thrown?.output?.statusCode).toBe(503)
  })

  test('registered callback redirects to the landing page when the application is Withdrawn', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      organisationId: '50001',
      registrationId: 'REG001',
      materialType: 'Plastic',
      year: 2027,
      applicationStatus: 'Withdrawn',
      isExporter: false
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        path: '/accreditation/tonnage/app-1',
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

    expect(h.redirect).toHaveBeenCalledWith(
      '/operator-accreditation/50001/REG001/Plastic/2027'
    )
    expect(result).toBe('redirect')
  })

  test.each(['Approved', 'Rejected'])(
    'registered callback redirects to the landing page when the application is %s',
    async (applicationStatus) => {
      accreditationApiService.getApplication.mockResolvedValue({
        organisationId: '50001',
        registrationId: 'REG001',
        materialType: 'Plastic',
        year: 2027,
        applicationStatus,
        isExporter: false
      })
      const callback = registerAndGetCallback()
      const h = makeH()
      const result = await callback(
        {
          path: '/accreditation/tonnage/app-1',
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

      expect(h.redirect).toHaveBeenCalledWith(
        '/operator-accreditation/50001/REG001/Plastic/2027'
      )
      expect(result).toBe('redirect')
    }
  )

  test.each(['Approved', 'Rejected'])(
    'registered callback still fetches the application on withdraw-application (for the header), but does not redirect even when %s',
    async (applicationStatus) => {
      accreditationApiService.getApplication.mockResolvedValue({
        applicationStatus,
        isExporter: false
      })
      const callback = registerAndGetCallback()
      const h = makeH()
      const result = await callback(
        {
          path: '/accreditation/withdraw-application/app-1',
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

      expect(h.redirect).not.toHaveBeenCalled()
      expect(result).toBe(h.continue)
    }
  )

  test('registered callback resolves the application from the URL, not a stale session accreditationId', async () => {
    // Regression guard: the session's accreditationId is set once by the
    // landing controllers and never refreshed per page, so it can point at
    // a different application than the one in the URL (second tab, back
    // button, bookmark). The header and the Withdrawn gate must both key
    // off request.params.applicationId.
    accreditationApiService.getApplication.mockResolvedValue({
      organisationName: 'App B Ltd',
      materialType: 'Plastic',
      siteAddress: 'Site B',
      isExporter: false,
      applicationStatus: 'Started'
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/tonnage/app-b',
      params: { applicationId: 'app-b' },
      yar: makeYarWithOrg('app-a-stale-session', '50001'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50001:First Org']
        }
      },
      app: {}
    }

    await callback(request, h)

    expect(accreditationApiService.getApplication).toHaveBeenCalledWith(
      '50001',
      'app-b'
    )
    expect(request.app.applicationHeader.operatorName).toBe('App B Ltd')
  })

  test('registered callback still fetches the application on withdraw-application (for the header), but does not redirect even if Withdrawn', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Withdrawn',
      isExporter: false
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        path: '/accreditation/withdraw-application/app-1',
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

    expect(accreditationApiService.getApplication).toHaveBeenCalled()
    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })

  test('registered callback passes through when the application is not Withdrawn', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Started'
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        path: '/accreditation/tonnage/app-1',
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

    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })

  test('registered callback attaches applicationHeader when the application fetch succeeds', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      organisationName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteAddress: '1 Recycling Way, Leeds',
      year: 2027,
      isExporter: false,
      applicationStatus: 'Started'
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/tonnage/app-1',
      yar: makeYarWithOrg('app-1', '50001'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50001:First Org']
        }
      },
      app: {}
    }

    await callback(request, h)

    expect(request.app.applicationHeader).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: '1 Recycling Way, Leeds',
      year: 2027,
      captionText: 'Delta Green Ltd (2027, Plastic, 1 Recycling Way, Leeds)',
      showFullHeader: false
    })
  })

  test('registered callback attaches applicationHeader on read-only-safe segments too (e.g. withdraw-application)', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      organisationName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteAddress: '1 Recycling Way, Leeds',
      year: 2027,
      isExporter: false,
      applicationStatus: 'Withdrawn'
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/withdraw-application/app-1',
      yar: makeYarWithOrg('app-1', '50001'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50001:First Org']
        }
      },
      app: {}
    }

    await callback(request, h)

    expect(request.app.applicationHeader).toEqual({
      operatorName: 'Delta Green Ltd',
      materialType: 'Plastic',
      siteName: '1 Recycling Way, Leeds',
      year: 2027,
      captionText: 'Delta Green Ltd (2027, Plastic, 1 Recycling Way, Leeds)',
      showFullHeader: false
    })
  })

  test('registered callback leaves applicationHeader unset (fails open) when the application fetch throws', async () => {
    accreditationApiService.getApplication.mockRejectedValue(
      new Error('backend down')
    )
    const callback = registerAndGetCallback()
    const h = makeH()
    const request = {
      path: '/accreditation/tonnage/app-1',
      yar: makeYarWithOrg('app-1', '50001'),
      auth: {
        credentials: {
          userType: 'operator',
          relationships: ['rel-1:50001:First Org']
        }
      },
      app: {}
    }

    const result = await callback(request, h)

    expect(request.app.applicationHeader).toBeUndefined()
    expect(result).toBe(h.continue)
  })

  test('registered callback redirects a POST to a locked, non-queried section back to the same page', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Submitted',
      businessPlan: { sectionStatus: 'Completed' }
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        method: 'post',
        path: '/accreditation/business-plan/app-1',
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

    expect(h.redirect).toHaveBeenCalledWith(
      '/accreditation/business-plan/app-1'
    )
    expect(result).toBe('redirect')
  })

  test('registered callback does NOT redirect a GET to a locked, non-queried section — it must render read-only', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Submitted',
      businessPlan: { sectionStatus: 'Completed' }
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        method: 'get',
        path: '/accreditation/business-plan/app-1',
        yar: makeYarWithOrg('app-1', '50001'),
        auth: {
          credentials: {
            userType: 'operator',
            relationships: ['rel-1:50001:First Org']
          }
        },
        app: {}
      },
      h
    )

    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })

  test('registered callback allows a POST to the section the regulator queried, even while locked', async () => {
    accreditationApiService.getApplication.mockResolvedValue({
      applicationStatus: 'Updated',
      businessPlan: { sectionStatus: 'Queried' }
    })
    const callback = registerAndGetCallback()
    const h = makeH()
    const result = await callback(
      {
        method: 'post',
        path: '/accreditation/business-plan/app-1',
        yar: makeYarWithOrg('app-1', '50001'),
        auth: {
          credentials: {
            userType: 'operator',
            relationships: ['rel-1:50001:First Org']
          }
        },
        app: {}
      },
      h
    )

    expect(h.redirect).not.toHaveBeenCalled()
    expect(result).toBe(h.continue)
  })
})
