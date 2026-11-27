import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  queryTaskListUrl,
  queryDeclarationUrl,
  landingUrl,
  naturalNumberLandingUrl,
  usesRegistrationNumber,
  reExBackLinkUrl,
  redirectIfStatusNot
} from './accreditationUrls.js'
import { config } from '../../../config/config.js'

describe('#queryTaskListUrl', () => {
  test('builds the query task list path for an applicationId', () => {
    expect(queryTaskListUrl('app-123')).toBe(
      '/accreditation/query-task-list/app-123'
    )
  })
})

describe('#queryDeclarationUrl', () => {
  test('builds the query declaration path for an applicationId', () => {
    expect(queryDeclarationUrl('app-123')).toBe(
      '/accreditation/query-declaration/app-123'
    )
  })
})

describe('#landingUrl', () => {
  function makeApplication(overrides = {}) {
    return {
      organisationId: 'org-1',
      registrationId: 'reg-1',
      materialType: 'Steel',
      year: 2027,
      ...overrides
    }
  }

  test('builds the operator landing URL from the application record', () => {
    expect(landingUrl(makeApplication())).toBe(
      '/operator-accreditation/org-1/reg-1/Steel/2027'
    )
  })

  test('is the same URL for exporter applications — isExporter is not part of the route', () => {
    expect(landingUrl(makeApplication({ isExporter: true }))).toBe(
      '/operator-accreditation/org-1/reg-1/Steel/2027'
    )
  })

  test('is unaffected by session state — derived entirely from the application record', () => {
    const application = makeApplication({
      organisationId: 'org-42',
      registrationId: 'reg-42'
    })
    const url = landingUrl(application)
    expect(url).not.toContain('undefined')
    expect(url).toBe('/operator-accreditation/org-42/reg-42/Steel/2027')
  })
})

describe('#naturalNumberLandingUrl', () => {
  const params = {
    organisationNumber: 50018,
    registrationNumber: 'R27EX0500180001PL',
    materialType: 'Plastic',
    year: 2028
  }

  test('builds the landing URL from the organisation and registration numbers', () => {
    expect(naturalNumberLandingUrl(params, 'en')).toBe(
      '/operator-accreditation/50018/R27EX0500180001PL/Plastic/2028'
    )
  })

  test('keeps the Welsh prefix', () => {
    expect(naturalNumberLandingUrl(params, 'cy')).toBe(
      '/cy/operator-accreditation/50018/R27EX0500180001PL/Plastic/2028'
    )
  })

  test('keeps a glass recycling process material segment', () => {
    expect(
      naturalNumberLandingUrl(
        { ...params, materialType: 'glass_re_melt' },
        'en'
      )
    ).toBe('/operator-accreditation/50018/R27EX0500180001PL/glass_re_melt/2028')
  })

  test('encodes the registration number', () => {
    expect(
      naturalNumberLandingUrl({ ...params, registrationNumber: 'R27/1' }, 'en')
    ).toBe('/operator-accreditation/50018/R27%2F1/Plastic/2028')
  })
})

describe('#usesRegistrationNumber', () => {
  test.each(['aaa000000000000000050001', '64F1C2A9E4B0A1B2C3D4E5F6'])(
    'is false for the Mongo id %s',
    (registrationId) => {
      expect(usesRegistrationNumber({ registrationId })).toBe(false)
    }
  )

  test.each([
    'R27EX0500180001PL',
    'aaa00000000000000005000',
    'aaa0000000000000000500011',
    'ggg000000000000000050001'
  ])('is true for %s, which is not a Mongo id', (registrationId) => {
    expect(usesRegistrationNumber({ registrationId })).toBe(true)
  })

  test('ignores the organisation segment, which the local stub makes numeric', () => {
    expect(
      usesRegistrationNumber({
        organisationId: '50001',
        registrationId: 'aaa000000000000000050001'
      })
    ).toBe(false)
  })
})

describe('#redirectIfStatusNot', () => {
  function makeApplication(overrides = {}) {
    return {
      organisationId: 'org-1',
      registrationId: 'reg-1',
      materialType: 'Steel',
      year: 2027,
      applicationStatus: 'Started',
      ...overrides
    }
  }

  function makeH() {
    return { redirect: vi.fn((url) => ({ redirectedTo: url })) }
  }

  test('returns null and does not redirect when the status matches', () => {
    const h = makeH()
    const result = redirectIfStatusNot(
      h,
      makeApplication({ applicationStatus: 'Started' }),
      'Started'
    )
    expect(result).toBeNull()
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('redirects to the landing URL when the status does not match', () => {
    const h = makeH()
    const application = makeApplication({ applicationStatus: 'Submitted' })
    const result = redirectIfStatusNot(h, application, 'Started')
    expect(h.redirect).toHaveBeenCalledWith(landingUrl(application))
    expect(result).toEqual({ redirectedTo: landingUrl(application) })
  })
})

describe('#reExBackLinkUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubBaseUrl(value) {
    const realGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'reex.frontendBaseUrl' ? value : realGet(key)
    )
  }

  test('deep-links to the Re-Ex registration page when both ids are present', () => {
    stubBaseUrl('https://reex.example')
    expect(reExBackLinkUrl('org-1', 'reg-1')).toBe(
      'https://reex.example/organisations/org-1/registrations/reg-1'
    )
  })

  test('falls back to the bare base URL when the registration id is missing', () => {
    stubBaseUrl('https://reex.example')
    expect(reExBackLinkUrl('org-1', undefined)).toBe('https://reex.example')
  })

  test('falls back to the bare base URL when the organisation id is missing', () => {
    stubBaseUrl('https://reex.example')
    expect(reExBackLinkUrl(undefined, 'reg-1')).toBe('https://reex.example')
  })
})
