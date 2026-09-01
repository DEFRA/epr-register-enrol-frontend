import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  queryTaskListUrl,
  queryDeclarationUrl,
  landingUrl,
  reExBackLinkUrl
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
