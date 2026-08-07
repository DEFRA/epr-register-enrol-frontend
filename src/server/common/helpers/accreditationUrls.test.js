import { describe, test, expect } from 'vitest'
import {
  queryTaskListUrl,
  queryDeclarationUrl,
  landingUrl
} from './accreditationUrls.js'

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
